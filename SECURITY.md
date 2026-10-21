# Security Policy

## Supported versions

Security fixes are provided for the latest released minor version.

| Version | Supported |
| ------- | --------- |
| 0.4.x   | ✅        |
| < 0.4   | ❌        |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private vulnerability reporting:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Describe the issue, the affected version, and reproduction steps.

If private reporting is unavailable, contact the maintainer listed in
`package.json` and include "FileVista security" in the subject.

You can expect an acknowledgement within 72 hours. Please allow time for a fix
to be developed and released before public disclosure.

## Scope

In scope:

- Path traversal or arbitrary file access from renderer input
- Command injection through file operations or external tools
- Sandbox or IPC boundary escapes
- Unsafe handling of dropped files or shell menu arguments
- Privilege escalation through the native bridge

Out of scope:

- Issues that require an already-compromised machine
- Denial of service caused by intentionally huge directory trees
- Vulnerabilities in third-party shell extensions invoked through the native
  context menu
- Windows itself refusing drag and drop between processes running at different
  integrity levels (this is expected OS behaviour)

## Security model

- The renderer runs with `contextIsolation: true`, `sandbox: true`, and
  `nodeIntegration: false`.
- The renderer can only reach the filesystem through the whitelisted IPC API in
  `electron/preload.cjs`.
- The main process validates that every path is absolute and normalises long
  paths before calling into Node's filesystem API.
- Files are opened with `shell.openPath`; no shell command strings are built.
- The native shell-menu bridge receives a single path argument and invokes the
  Windows shell menu for that item.
