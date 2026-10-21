# Contributing to FileVista

Thanks for taking the time to contribute. This project favours small, focused
changes that keep the interface quiet, fast, and predictable.

## Before you start

- Search existing issues and pull requests first.
- For anything larger than a bug fix, open an issue describing the problem and
  your proposed approach before writing code.
- By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

Requirements:

- Windows 10 or 11
- Node.js 20 or newer
- npm 10 or newer
- .NET Framework 4.x (only needed to rebuild the native shell-menu bridge)

```powershell
git clone https://github.com/jeffecai/FileVista.git
cd FileVista
npm install
npm run dev
```

`npm run dev` starts Vite and Electron with hot reload.

## Project layout

```text
electron/   Main process: window, IPC, filesystem engine, tests
src/        Renderer: React components, state, styles
native/     C# COM bridge for the Windows shell context menu
docs/       Design system, architecture notes, screenshots
scripts/    Build helpers
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/DESIGN.md](docs/DESIGN.md) before touching the core.

## Coding guidelines

- TypeScript is strict. Do not silence errors with `any`, `@ts-ignore`, or
  non-null assertions unless the invariant is genuinely guaranteed.
- Keep filesystem work in the main process. The renderer must only call the
  typed API exposed by `electron/preload.cjs`.
- Validate every path in the main process; use the helpers in
  `electron/paths.cjs` for long-path handling.
- Follow the existing visual language. New colours must come from the tokens in
  `src/styles.css`. Avoid cards, gradients used as decoration, and shadow-heavy
  chrome; the design language is documented in `docs/DESIGN.md`.
- Prefer plain CSS over new UI dependencies.
- Keep user-facing strings in Chinese, matching the existing tone: short,
  declarative, no exclamation marks.

## Commit messages

Use short imperative subjects. Conventional Commits prefixes are welcome but not
mandatory:

```text
feat: add quick filter to the file list
fix: keep selection after renaming
docs: clarify portable settings location
```

Keep the subject under 72 characters. Explain *why* in the body when the change
is not obvious.

## Tests and checks

Run these before opening a pull request:

```powershell
npm run build          # type check + production build
npm run test           # filesystem engine self-test (17 checks)
npm run test:drag      # simulated external file drop
```

`npm run build` must pass. If your change touches the native bridge:

```powershell
npm run build:native
native\ShellMenu.exe --path .\README.md --dump
```

The dump should list the normal Explorer verbs (Open, Properties, installed
shell extensions).

## Pull requests

- One concern per pull request.
- Describe the user-visible change and how you verified it.
- Include a screenshot or short recording for interface changes.
- Update `CHANGELOG.md` under `Unreleased` for user-visible changes.
- Do not commit `node_modules`, `dist`, local sessions, or personal paths.

## Reporting bugs

Use the bug report template. Include:

- FileVista version (shown in the command palette footer or `package.json`)
- Windows version
- Steps to reproduce
- Expected and actual behaviour
- Whether the app was running elevated

## Security

Please do not open public issues for security problems. See
[SECURITY.md](SECURITY.md).
