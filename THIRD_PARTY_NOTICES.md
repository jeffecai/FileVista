# Third-party notices

FileVista is distributed under the MIT License. It depends on the following
open-source projects and assets. Their licences apply to their respective
portions.

## Runtime dependencies

| Project | Licence | Use |
| --- | --- | --- |
| [Electron](https://github.com/electron/electron) | MIT | Desktop runtime |
| [React](https://github.com/facebook/react) | MIT | Renderer UI |
| [Zustand](https://github.com/pmndrs/zustand) | MIT | State management |
| [TanStack Virtual](https://github.com/TanStack/virtual) | MIT | Virtual scrolling |
| [Lucide](https://github.com/lucide-icons/lucide) | ISC | Interface icons |
| [koffi](https://github.com/Koromix/koffi) | MIT | Win32 FFI for file attributes |
| [Vite](https://github.com/vitejs/vite) | MIT | Build tooling |
| [TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 | Type system |

## Fonts

| Font | Licence |
| --- | --- |
| [Newsreader](https://github.com/productiontype/Newsreader) | SIL Open Font License 1.1 |
| [IBM Plex Sans](https://github.com/IBM/plex) | SIL Open Font License 1.1 |
| [IBM Plex Mono](https://github.com/IBM/plex) | SIL Open Font License 1.1 |
| [Noto Serif SC](https://github.com/notofonts/noto-cjk) | SIL Open Font License 1.1 |

## Native bridge

`native/ShellMenu.exe` is compiled from `native/ShellMenu.cs` in this repository
and links against the .NET Framework 4.x class library and Windows shell APIs.
The .NET Framework is provided by Windows.

## External applications

FileVista can discover and launch [Beyond Compare](https://www.scootersoftware.com/)
if it is installed. Beyond Compare is commercial software and is not bundled
with this project. Windows shell extensions shown in the native context menu
(for example 7-Zip or Beyond Compare) are owned by their respective authors.
