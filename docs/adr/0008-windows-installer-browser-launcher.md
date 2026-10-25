# 0008. Windows installer: bundled Node and a shortcut that opens the browser

Date: 2026-10-25
Status: accepted (replaces "Desktop installer (Tauri)" on the out-of-MVP list in ROADMAP.md)

## Context

HRmit is meant for recruiters, who are mostly not technical. Today they need Node 24, pnpm, git and a terminal (`git clone`, `pnpm install`, `pnpm dev`). That is the main reason someone would watch the demo and never install the real thing.

HRmit is a web app on purpose: it runs in the browser people already use. The installer should keep that and only remove the setup: install once, then a desktop icon that starts HRmit and opens it in the browser.

The server is Node with no native modules: SQLite is `node:sqlite`, and CV parsing (`unpdf`, `mammoth`) and mail (`nodemailer`) are plain JavaScript. So the backend bundles into one JavaScript file that runs on a plain `node.exe`.

Options considered:

- **Electron or Tauri**: a window of its own, so another browser to ship (about 100 MB) and a different way of using HRmit than the browser tab. An Electron build was tried and dropped for that reason.
- **A Node single executable (SEA)**: one file, but Node 24 SEA wants a CommonJS entry and the server uses top-level await.
- **The official `node.exe` next to the bundle, packed by an NSIS installer**: no new runtime, and the installer is about 25 MB.

## Decision

- **`apps/windows`.** `build.js` bundles the server with esbuild (one ESM file, a `createRequire` banner for the CommonJS dependencies). It copies the migrations, the web build, the launcher and the icon, and copies the `node.exe` running the build as `HRmit.exe`, so the shipped Node is the one CI set up. Then `makensis` builds `HRmit-Setup-<version>.exe`.
- **The shortcut runs `HRmit.exe launcher.mjs`, minimized.** The launcher checks `http://127.0.0.1:7300/api/health`. If nothing answers, it starts the server as a detached process with no window, waits for the health check and opens the address in the default browser. A second click only opens the browser. If the server does not come up (port taken, crash), Notepad opens the log. The port is fixed, so the address, bookmarks and the browser's saved language and theme stay the same. The server is the same code as `pnpm dev`, with the same loopback binding and Origin/Host check.
- **Stopping** is the existing "Shut down HRmit" button in Settings → General. The process shows as `HRmit.exe` in Task Manager.
- **Per user, no administrator rights.** The program goes to `%LOCALAPPDATA%\Programs\HRmit`, with shortcuts on the desktop and in the Start menu and an entry in Apps. Data goes to `%APPDATA%\HRmit\data`, with the log next to it in `hrmit.log`. The installer never touches the data, so it survives updates and uninstalls. Installing and uninstalling stop a running HRmit first (`taskkill /IM HRmit.exe`), since it holds its files open.
- **Unsigned for now.** Windows SmartScreen shows "Windows protected your PC" on first run. The README explains "More info → Run anyway". Signing (SignPath for open source, or Azure Trusted Signing) is a later step.
- **Distributed through GitHub Releases.** `release.yml` builds the installer on every `vX.Y.Z` tag on a Windows runner and attaches it to the release. The README links to `releases/latest`.
- **Updates.** The update check from 0.5.5 answers `install: 'installer'`. The dialog then links to the new installer, which replaces the program and keeps the data.

## Consequences

- One small workspace package (a build script, a launcher, an NSIS script, an icon). The server gains three env overrides (`HRMIT_WEB_DIST`, `HRMIT_MIGRATIONS_DIR`, `HRMIT_INSTALLER`); nothing else in it changes.
- HRmit stays a browser app everywhere: `pnpm dev`, Docker and the installer show the same UI the same way.
- Node security releases reach users only with a new HRmit release, so bumping Node is part of each release (CI takes the latest 24.x).
- The launcher's console blinks in the taskbar for a moment on each click; that is the price of using plain `node.exe`.
- Port 7300 can be taken by another program. The server then fails to start and the launcher shows the log. (ponytail: no port fallback, since a moving port would also move the browser's saved settings.)
- Unsigned builds cost trust on first run. That is the main reason to add signing before promoting the download widely.
