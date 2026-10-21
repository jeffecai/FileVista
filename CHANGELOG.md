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

## [0.4.1] - 2026-10-22

### Fixed

- Removed the brief normal-sized window that appeared before the main window
  was maximized; the window is now shown only after the first renderer frame.

### Changed

- Closing the window now minimises it to the taskbar instead of exiting.
- Quitting is explicit: use the tray icon menu or the taskbar jump-list task
  "退出 FileVista".

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
