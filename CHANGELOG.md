# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Repository reorganised as a standard open-source project: design and
  architecture notes moved to `docs/`, CI workflow, issue/PR templates,
  contribution guide, security policy, and third-party notices added.
- README rewritten with feature tables, screenshots, keyboard reference, and
  build instructions.

## [0.5.1] - 2026-10-22

### Changed

- Folder icons now use a single macOS-style blue instead of six colours hashed
  from the folder name.

### Fixed

- `.lnk` and `.url` items now resolve their target application icon instead of
  falling back to a generic shortcut icon.
- Avoid synchronously reading large `.exe` files when a shortcut specifies an
  icon location, which could block the main process during directory listing.

## [0.5.0] - 2026-10-22

### Added

- Colour icon mode: 27 hand-drawn SVG type icons, six folder colour variants
  chosen by name hash, and native Windows icons for executables, shortcuts and
  unknown types.
- Colour/monochrome toggle in the path bar and command palette; the preference
  is stored in the session.

## [0.4.2] - 2026-10-22

### Added

- `FileVista.exe`: a tiny windowed launcher so double-clicking starts the app
  without a flashing console window.
- NSIS installer and portable build via `electron-builder`
  (`npm run dist:win`), with Start Menu and desktop shortcuts.
- Packaged builds run as `FileVista.exe`, so taskbar pinning no longer captures
  `electron.exe`.

### Changed

- `X` now hides the window to the notification area (the taskbar button
  disappears); `-` still minimises to the taskbar.
- First hide shows a tray balloon explaining how to restore or quit.
- Restoring from the tray also restores the taskbar button.

## [0.4.1] - 2026-10-22

### Fixed

- Removed the brief normal-sized window that appeared before the main window
  was maximized; the window is now shown only after the first renderer frame.

### Changed

- Closing the window now minimises it to the taskbar instead of exiting.
- Quitting is explicit: use the tray icon menu, the taskbar jump-list task
  "退出 FileVista", or the exit button on the taskbar thumbnail preview.

## [0.4.0] - 2026-10-22

### Added

- Native Windows Shell context menu through a small C#/COM bridge
  (`native/ShellMenu.exe`), including third-party shell extensions such as
  7-Zip and Beyond Compare.
- Themed FileVista context menu on `Ctrl + right-click` and on multi-selection.
- "This PC" destination: drive list with total/free space, usage percentage,
  and an animated blue gradient capacity bar.
- Mini capacity bar in each pane's status bar.
- Beyond Compare integration: compare two selected items, or the current item
  against the other pane's selection. Auto-discovery via registry, common paths,
  and a manual locate fallback.
- Command palette entries for layout, view modes, sorting, and comparison.

### Changed

- Right-click on a single item opens the native shell menu; multi-selection and
  `Ctrl + right-click` open the themed menu.

## [0.3.0] - 2026-10-22

### Added

- Four-pane (2×2) layout with shared column/row splitters.
- Three view modes: list, small icons, and extra-large thumbnails.
- Windows thumbnail generation, batched and cached in the main process.
- Sidebar preview with image dimensions in extra-large view.
- Real Windows hidden-file attributes via `koffi` and `GetFileAttributesW`.
- Drag files in from Explorer and drag the current selection out to Explorer.

## [0.2.0] - 2026-10-22

### Added

- Renamed the application to FileVista.
- New multi-resolution application icon.
- Portable settings under `%APPDATA%\FileVista`.

## [0.1.0] - 2026-10-22

### Added

- Initial dual-pane file manager MVP.
- Tabs, breadcrumbs, path input, sorting, hidden-file toggle.
- Copy, move, rename, create folder, recycle bin, conflict policies.
- Preview drawer for text and images.
- Command palette and keyboard-first navigation.
- Session persistence and custom frameless title bar.

[0.4.0]: https://github.com/jeffecai/FileVista/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/jeffecai/FileVista/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/jeffecai/FileVista/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jeffecai/FileVista/releases/tag/v0.1.0
