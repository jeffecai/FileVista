# Architecture

This document describes how FileVista is put together, where responsibilities
live, and which invariants new code must preserve.

## Overview

FileVista is an Electron application with three layers:

```text
┌──────────────────────────────────────────────────────────────┐
│ Renderer (src/)                                              │
│ React 18 · Zustand · TanStack Virtual · plain CSS            │
│ No Node.js access. Only window.folio.*                       │
└───────────────────────────┬──────────────────────────────────┘
                            │ typed IPC (contextBridge)
┌───────────────────────────▼──────────────────────────────────┐
│ Preload (electron/preload.cjs)                               │
│ Whitelisted invoke/on wrappers, webUtils.getPathForFile      │
└───────────────────────────┬──────────────────────────────────┘
                            │ ipcMain.handle / webContents.send
┌───────────────────────────▼──────────────────────────────────┐
│ Main process (electron/)                                     │
│ Window, session, filesystem engine, transfer queue, preview  │
│ Win32 attributes (koffi), thumbnails (nativeImage)           │
└───────────────┬───────────────────────────────┬──────────────┘
                │ spawn                         │ spawn
        Beyond Compare                  ShellMenu.exe (C#/COM)
```

The renderer never touches `fs`, `child_process`, or the registry.

## Process model

### Main process

`electron/main.cjs` owns:

- Window creation (frameless, custom title bar, single instance)
- Session persistence (`session.json`, `window.json`)
- Directory watching (`fs.watch`, debounced, per sender)
- All `ipcMain.handle` endpoints
- Thumbnail generation and cache
- Native shell menu and Beyond Compare launching

### Preload

`electron/preload.cjs` exposes exactly one object, `window.folio`. Every method
returns a promise and unwraps the `{ ok, data, error }` envelope produced by the
main process. Renderer code must not add new Node APIs to this file without a
matching, validated handler.

### Renderer

- `src/store.ts` is the single source of truth: panes, tabs, listings, cursor,
  selection, operations, dialogs, preview, view mode, layout.
- Components are presentational. They read from the store with selectors and
  call actions.
- `src/App.tsx` owns global keyboard handling and the pane layout.
- Listings are keyed by tab id (`runtimes[tabId]`), so tabs keep their own
  cursor and selection.

## Pane and tab model

Four pane slots exist in the store: `a`, `b`, `c`, `d`.

```text
dual:  [a] │ [b]
quad:  [a] │ [b]
       ─────┼─────
       [c] │ [d]
```

- Dual mode shows `a` and `b`; quad mode shows all four.
- Each pane has tabs, and each tab has its own path, history, sort state and
  listing runtime.
- `activePane` is always one of the visible panes.
- `F5`/`F6` target the partner pane: `a↔b`, `c↔d`.
- The pseudo path `::thispc` renders `DriveView` instead of a filesystem
  listing. The store synthesises entries from the drive list so keyboard
  navigation and selection work unchanged.

## Filesystem engine

`electron/fs-service.cjs` provides:

| Function | Notes |
| --- | --- |
| `listDir` | `readdir` + `lstat` with a 40-way concurrency limit; reads Win32 attributes |
| `drives` | Probes `A:`–`Z:` with `fs.statfs` |
| `preview` | Text and image preview with size caps; never blocks the UI |
| `makeDir` / `rename` / `trash` | Validated absolute paths, long-path aware |
| `checkConflicts` | Detects top-level name collisions before a transfer |
| `transfer` | Background copy/move with policies `replace`, `skip`, `keepboth` |
| `cancel` | Cooperative cancellation between files |

Invariants:

- Every incoming path goes through `assertPath` (absolute + normalised) and
  `toLong` before a filesystem call.
- Copy never follows directory symlinks or junctions; it recreates the link.
- A partially written destination file is removed on failure.
- Transfer errors are collected per top-level source and reported, never
  swallowed.
- Progress events are throttled to ~120 ms.
- Directory creation also counts as progress, so copying an empty folder does
  not report "0 items".

## IPC surface

The renderer API is declared in `src/types.ts` (`FolioApi`). Channels:

```text
folio:listDir          folio:drives           folio:places
folio:preview          folio:thumbnails       folio:mkdir
folio:rename           folio:trash            folio:openPath
folio:reveal           folio:checkConflicts   folio:transfer
folio:cancel           folio:session:load     folio:session:save
folio:watch            folio:copyText         folio:startDrag
folio:takeDragSource   folio:compare          folio:compare:locate
folio:shellMenu        folio:win              folio:menu

events: folio:progress, folio:dir-changed, folio:window-state
```

Add a channel in all three places: main handler, preload wrapper, and
`FolioApi`.

## Windowing and session

- Frameless window with custom controls; `-webkit-app-region: drag` on the
  title bar.
- The window is shown only after the renderer reports its first frame, so there
  is no blank or normal-sized flash before the maximised window appears.
- `X` hides the window and removes its taskbar button (`setSkipTaskbar(true)`);
  the tray icon remains. `-` performs a normal minimise and keeps the taskbar
  button.
- Quitting is explicit: tray menu, taskbar thumbnail toolbar, or taskbar jump
  list. `isQuitting` guards the `close` handler so those paths can actually
  close the window.
- Window bounds and maximised state live in `window.json`.
- Tabs, layout, view mode, sort, preview visibility and active pane live in
  `session.json`, version 2. Version 1 sessions are migrated on load.
- Both files live in `%APPDATA%\FileVista`.

## Native integrations

### Launcher

`FileVista.exe` is a tiny WinExe compiled from
`native/FileVistaLauncher.cs`. It resolves `node_modules\electron\dist\electron.exe`
next to itself, starts it with the project directory as the app path, and exits.
Because it is a windowed subsystem executable, double-clicking it never opens a
console window.

### Windows shell menu

`native/ShellMenu.exe` is a 10 KB C# helper. It:

1. Binds the target path through `SHGetDesktopFolder` / `ParseDisplayName`.
2. Obtains `IContextMenu` via `GetUIObjectOf`.
3. Calls `QueryContextMenu` and `TrackPopupMenuEx`.
4. Forwards `WM_INITMENUPOPUP`, `WM_DRAWITEM` and `WM_MEASUREITEM` to
   `IContextMenu2/3` so submenus populate.
5. Invokes the chosen command with `CMINVOKECOMMANDINFOEX`.

Rebuild it with `npm run build:native`. `--dump` prints the menu tree without
showing it, which is useful for CI and debugging.

The renderer uses the native menu for a single right-clicked item. Multi-item
selection and `Ctrl + right-click` fall back to the themed Electron menu so
FileVista-specific actions remain available. If the helper exits with an error
within 400 ms, the themed menu is shown instead.

### Beyond Compare

`electron/compare.cjs` resolves `BCompare.exe` in this order:

1. `settings.json` (`bcompare`)
2. Registry `Scooter Software\Beyond Compare {5,4,3}` → `ExePath`
3. `Program Files`, `Program Files (x86)`, `%LOCALAPPDATA%\Programs`
4. File picker (saved back to `settings.json`)

Paths are passed as separate `spawn` arguments; no shell is involved.

### Thumbnails

`nativeImage.createThumbnailFromPath` with a 6-way concurrency limit. Results
are cached by `path + mtime + size` (max 600 entries) and returned as data URLs.
Only visible items in the extra-large view request thumbnails.

## Packaging

Packaging is configured in the `build` field of `package.json` and uses
`electron-builder`:

- `npm run pack:win` produces an unpacked app in `release/win-unpacked/`.
- `npm run dist:win` produces an NSIS installer and a portable executable.
- `asar` is enabled; `native/**`, icon assets and `node_modules/koffi/**` are
  unpacked so the shell-menu helper and the Win32 FFI native module can be
  executed from disk.
- The packaged executable is `FileVista.exe` with product metadata and the
  `com.filevista.app` AppUserModelID. This is what allows Windows to pin
  FileVista itself instead of `electron.exe`.
- The installer creates Start Menu and desktop shortcuts. Source-mode runs use
  `electron.exe`, so pinning those windows captures Electron by design.

## Styling

All visual decisions live in `src/styles.css` as custom properties. The design
language is documented in [DESIGN.md](DESIGN.md). Do not introduce Tailwind,
CSS-in-JS, or component libraries.

## Performance

- Virtual scrolling for lists and grids.
- `readdir` + `lstat` concurrency capped at 40.
- Transfer progress throttled; UI updates are batched by React.
- Directory watching is per visible path and re-bound only when paths change.
- Thumbnails are lazy and cached.
- Network paths are listed asynchronously; the renderer shows a loading state
  instead of blocking.

## Testing

- `npm run test` — 17 filesystem checks in a temporary directory, including
  long paths, symlinks, conflict policies, recycle bin, and Win32 attributes.
- `npm run test:drag` — CDP-driven external file drop against the real UI.
- `npm run smoke` — builds and captures `smoke.png`, `smoke-palette.png`,
  `smoke-preview.png` for visual review.
- `native/ShellMenu.exe --path <p> --dump` — enumerates the real shell menu.

## Adding a feature

1. Decide whether it needs filesystem access. If yes, add a main-process
   function first and test it in `selftest.cjs`.
2. Add the IPC channel, preload wrapper, and `FolioApi` type.
3. Add store state/actions; keep components presentational.
4. Add keyboard handling in `App.tsx` and a command palette entry.
5. Update `README.md`, `CHANGELOG.md`, and screenshots if the UI changed.
