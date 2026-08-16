# Startup & Deployment

## Normal Production Startup

The app runs on **port 44558** (configurable, see below) via a Windows scheduled task named **"HandyMon"**.

The task's action runs `launch-hidden.ps1` directly (`powershell -WindowStyle Hidden -File launch-hidden.ps1`, `-WorkingDirectory` set to the install directory so it works regardless of install location), which in turn starts `tray-main.js` — the task runs the tray wrapper, not the headless `next start` server. The hidden-launch indirection exists because `node.exe` is a console-subsystem executable: launched directly from a Scheduled Task action, Windows shows a visible console window, and closing that window kills the process. `-WindowStyle Hidden` suppresses it. (An earlier version of this ran through an intermediate `run-handymon.bat`; the task action points straight at `launch-hidden.ps1` now — see `register-task.ps1` inside `buildNsiScript()` in `scripts/package-win.js`.)

To manually start or restart the task:
```
schtasks /run /tn "HandyMon"    # start
schtasks /end /tn "HandyMon"    # stop
```

Or use the npm scripts:
```
npm run start-service      # schtasks /run
npm run restart-service    # end, wait 2s, run
```

## Tray Wrapper

`tray-main.js` is the actual production entry point run by the scheduled task. No Electron/Chromium involved — see [architecture.md](architecture.md) for why (short version: the dashboard is always viewed in the user's own browser, phone or desktop, never rendered inside this process, so an embedded browser engine was never actually needed). It:
1. Creates a system tray icon via a native `System.Windows.Forms.NotifyIcon` (`tray-native.js`, loading a DLL precompiled ahead of time — see [Native Interop Compilation](#native-interop-compilation) below) — not a bundled GUI framework.
2. Tray context menu: **Open UI** (opens the dashboard in the default browser), **Pair new device**, **Open config folder**, **Quit**.
3. Starts an embedded Next.js server on the configured port (uses `require('next')` directly, not a subprocess).

Run standalone with:
```
npm run start:tray
```

`npm run start:prod` (headless, no tray icon, runs `server.js`) also exists and works, but is not what the scheduled task runs — use it only if you specifically don't want a tray icon and are managing the process another way. It's `server.js`, not bare `next start`, so it gets the same Host-header-spoofing protection as the tray path (see [architecture.md](architecture.md) for how `server-guard.js` enforces this).

## Port

The port defaults to **44558** and is configurable via `%LOCALAPPDATA%\HandyMon\config.json`'s `port` field (`read-port.js` is the shared reader both `tray-main.js` and `server.js` use — they're plain-JS root-level entry points, outside the Next app in `src/`, so they can't import `src/utils/app-config.ts`'s TS reader directly; `config-dir.js` is the plain-JS equivalent of `src/utils/dirs.ts`'s `CONFIG_DIR`, shared by both). `server-guard.js`'s Host-header check already tolerates any port (`(:\d+)?` in its regex), so no changes needed there when the port changes.

The installer has an **Advanced Options** page for this (see below) — for a from-source run, edit the config file directly and restart. There's no in-app Settings UI for it, since changing the port requires restarting the HTTP listener the Settings page itself is served from.

## Accessing from Other Devices

The app binds to `0.0.0.0` by default (Next.js default), so it's accessible from any device on the local network at `http://<machine-ip>:44558`.

You may need a Windows Firewall inbound rule to allow traffic on port 44558 from your local subnet.

## Build Before Running

The scheduled task runs the **production build** (`next start`), not the dev server. After pulling changes or editing source, rebuild before restarting:

```
npm run build
npm run restart-service
```

## Native Interop Compilation

Every native-interop module (audio, display, the persistent worker, the tray icon) is real C# under `native-src/*.cs`, compiled to a DLL/exe by `scripts/compile-native.js` — the *only* place any of this is ever compiled. It's a plain, direct `Add-Type`-per-file script (no server, no HTTP, no caching/hashing — it just always recompiles when run) and is wired in three places:
- `predev` / `predev:secure` npm hooks — compiles into `<repo-root>/native/` before `npm run dev` / `npm run dev:secure` starts.
- `prebuild` npm hook — same, before `npm run build`, so a git-checkout production deploy (`npm run build` + `npm run restart-service`) always has current assemblies.
- `scripts/package-win.js`'s `precompileNativeInterop()` step — same script, pointed at the staged build dir instead (`--out <BUILD_DIR>/native`), so the installer ships already-built binaries.

Run it manually with `npm run compile-native` (optionally `-- --out <dir>`).

Runtime code (`native-audio.ts`, `native-display.ts`, `native-worker.ts`, `tray-native.js`) never compiles anything itself — each just checks its expected output file exists and throws a clear error pointing at `npm run compile-native` if not. `src/utils/dirs.ts`'s `NATIVE_DIR` resolves where that output is expected to live for the current run mode: `<repo-root>/native` for dev and git-checkout production (`process.cwd()` for bare `next dev`, or `HANDYMON_INSTALL_DIR` — set by `tray-main.js`/`server.js` to their own `__dirname`, which for a git checkout is the repo root), or the actual install directory for a packaged build.

The one place this could still change: if a future feature lets a user author their own C# (e.g. a custom action step), that specific case would need a narrow runtime-compile path of its own — everything else stays build-time-only.

## Packaged / Installed Build

A hand-written NSIS installer (not electron-builder — that's an Electron-specific packager and doesn't apply now that there's no Electron) produces a double-clickable Windows installer that needs neither Node.js nor `npm` on the target machine — it bundles a real `node.exe` alongside a trimmed copy of the app instead. This is separate from — and doesn't replace — the `build` + `restart-service` flow above, which stays a valid way to deploy from a git checkout.

**Building the installer**: `npm run package:win` (`scripts/package-win.js`) does the whole thing:
1. `next.config.js` sets `output: 'standalone'` — Next's own dependency tracer prunes `node_modules` far more aggressively than a raw `npm install --omit=dev` would (e.g. `@mui/icons-material` ships one file per icon, ~94MB, even though the app only imports a handful; standalone tracing only copies what's actually reachable).
2. Stages `.next/standalone` + `.next/static` + `public/` + the root entry-point files (`tray-main.js`, `tray-native.js`, `server-guard.js`, `read-port.js`, `config-dir.js`, `launch-hidden.ps1`, `handymon.png`, `help.html`) + a copy of `node.exe`, into `C:\HandyMon-build` — **outside this repo deliberately**, since the repo lives inside a NextCloud-synced folder (rapid multi-file operations there are prone to transient EPERM locks from the sync client) and to stay under Windows' MAX_PATH limit.
3. **Known gap, patched automatically**: standalone's traced `node_modules/next` is missing `next/dist/compiled/webpack/*` — our custom `next({dev:false,dir})` + `.prepare()` + `.getRequestHandler()` usage needs it (`config-utils.js` eagerly requires it) even though Next's own *generated* standalone `server.js` doesn't (different internal API, `next/dist/server/lib/start-server`). The script replaces the traced `node_modules/next` with the full untrimmed copy from the repo's own `node_modules`. It also deletes `@next/swc-win32-x64-msvc` (142MB, build-time-only compiler, unneeded when serving a pre-built app), `sharp`+`@img/sharp-win32-x64` (confirmed `next/image` is unused), and `typescript`+`caniuse-lite` (build-time-only, gets traced in but unneeded at runtime).
4. **Precompiles every native-interop assembly** (audio/display/native-worker/tray) into `BUILD_DIR\native\`, by running `scripts/compile-native.js --out BUILD_DIR/native` directly — see [Native Interop Compilation](#native-interop-compilation) above. Production never compiles any of this at runtime — the install directory needs admin to write to at all, so a runtime fallback isn't something to rely on there. The packaging script fails loudly if any expected assembly doesn't show up afterward.
5. Compiles via `makensis.exe` (NSIS — must be installed separately, e.g. `winget install NSIS.NSIS`, or via the standard installer at `C:\Program Files (x86)\NSIS`) against a generated `.nsi` script:
   - A **Components** page (`MUI_PAGE_COMPONENTS`) offers two optional bundled-tool sections — **PresentMon** and **LibreHardwareMonitor + PawnIO driver**. On a genuinely fresh install (no existing `config.json`) both default checked. On a reinstall/upgrade, `.onInit` reads `bundledLhm`/`bundledPresentMon` back from the existing `config.json` and defaults each checkbox to exactly what was selected last time — a direct, deterministic record (`WriteBundledToolFlags`, called from the Core section below) rather than inferring it from indirect signals. Two earlier attempts at inference (checking a hardcoded `Program Files\LibreHardwareMonitor` path; later, comparing `lhmPort` + a live process check) were each replaced — the first misfired for a reason never pinned down, the second worked but was needless guessing once the flags could just be written directly. See "Bundled tools" below.
   - An **Advanced Options** page (`nsDialogs`) lets the installing user change the dashboard port from the default 44558 — pre-filled from the existing `config.json`'s `port` if this is a reinstall (read via a temp PowerShell script + `nsExec::ExecToStack`), so re-running the installer doesn't silently reset a previously-customized port. The chosen value is written into `%LOCALAPPDATA%\HandyMon\config.json` via another temp PowerShell script that does a proper `ConvertFrom-Json`/`Add-Member`/`ConvertTo-Json` merge (not a naive overwrite), so it doesn't clobber other settings already in that file. The same script writes `bundledLhm`/`bundledPresentMon` (always, both branches) and `lhmPort` (only when the LHM component was selected, so a skip-bundling install keeps the ecosystem-default 8085).
   - Registers the same elevated `Register-ScheduledTask` (see Port section above) at install time, removes it at uninstall time.
   - Creates a Start Menu **HandyMon** group with three shortcuts: **Start HandyMon** (`schtasks /run`, for when the "launch now" finish-page checkbox wasn't used), **HandyMon Help** (opens `help.html`), **Uninstall HandyMon**.
   - If "Launch HandyMon now" is checked on the finish page, `help.html` also opens automatically alongside starting the task — first-run guidance without an extra click.
6. Final installer lands at `dist/HandyMon-Setup-<version>.exe` (version comes from `package.json`).

Final size: ~228MB staged (core app) — down from ~570MB for the old Electron build, since there's no bundled Chromium at all — plus the two optional bundled-tool components (PresentMon + LibreHardwareMonitor/PawnIO, together well under 50MB) if selected.

**Bundled tools** (`stageBundledTools()` in `scripts/package-win.js`): downloads version-pinned releases of PresentMon, LibreHardwareMonitor, and PawnIO's installer from their GitHub releases (see the constants at the top of the script for exact versions/URLs and why — PresentMon in particular is pinned to v2.5.1, not "latest", so a future release can't silently change its CLI out from under `src/utils/presentmon.ts` without someone verifying it first — v2.5.1 itself was confirmed compatible with `--v1_metrics`/`--output_stdout` directly against a real binary, contrary to an earlier assumption here that 2.4+ broke it), caches them in `C:\HandyMon-package-cache` (not wiped between packaging runs, unlike `BUILD_DIR`) so repeat builds don't re-download, and stages them into `C:\HandyMon-build-optional` — a sibling to `BUILD_DIR`, deliberately outside it so the installer's main `File /r "${STAGE_DIR}\*.*"` never picks them up; only the two optional NSIS sections do, conditionally. LibreHardwareMonitor's zip gets a hand-written `LibreHardwareMonitor.config` dropped in next to the extracted exe (format confirmed against its own `PersistentSettings.cs` source, not guessed) with its web server pre-enabled on a distinct port and set to start minimized — see `lhmConfigXml()` in the packaging script.

**`node.exe` selection**: defaults to whatever's currently running the packaging script (`process.execPath` — fine for local testing), but set `HANDYMON_NODE_EXE` to a specific `node.exe` path (e.g. an nvm-managed LTS install) before running `npm run package:win` when cutting a real release — the local dev machine's active Node version may be old/EOL and isn't guaranteed to match what you actually want to ship.

**Finding the config**: the tray menu has an **"Open config folder"** item that opens `%LOCALAPPDATA%\HandyMon` directly (config, paired devices, logs — same location whether running from a git checkout or an installed build). Compiled native-interop assemblies live under the *install directory's* own `native\` subfolder in a packaged build (precompiled at package time, per step 4 above) rather than here, since they're a build output, not user data — see `dirs.ts`'s `NATIVE_DIR` in [utilities.md](utilities.md).

**Finding help**: `help.html` (repo root) is a self-contained getting-started page — no build step, no external requests — covering the tray menu, pairing a phone, starting/stopping, and basic troubleshooting. It's opened automatically when "Launch HandyMon now" is checked on the finish page, and reachable anytime after via the **HandyMon Help** Start Menu shortcut.

**Task-name collision risk**: since the installer registers a task literally named `"HandyMon"`, installing/testing this build on a machine that already runs the production task from a git checkout will silently retarget that task to point at the packaged exe instead. Before testing the installer on a machine with a live task:
```
schtasks /query /tn "HandyMon" /xml > handymon-task-backup.xml
```
Restore with (note: `schtasks /query ... > file` via a non-cmd.exe shell can write the wrong text encoding — the file's declared `encoding="UTF-16"` XML prolog must match its actual bytes, or `schtasks /create /xml` rejects it as malformed):
```
schtasks /create /xml handymon-task-backup.xml /tn "HandyMon" /f
```

**Elevation confirmation**: the installer shows an explicit Yes/No dialog before registering the task, explaining why elevation is needed — the generic Windows UAC prompt alone doesn't explain what's actually being changed.

## Release Pipeline (GitHub Actions)

Branching model: `development` is the everyday working branch (and the repo's default branch on GitHub); `main` is release-only — nothing lands there except a deliberate merge from `development`, and that merge is what triggers a release. Bump `package.json`'s `version` as part of preparing a release, before merging to `main` — it's the single source of truth for the release tag and installer filename.

**`.github/workflows/release.yml`** — triggered on push to `main`. Reads the version from `package.json`, skips the whole build if a release for `vX.Y.Z` already exists (so re-merging or re-running is a safe no-op, not a clobber), otherwise installs NSIS (`choco install nsis -y`), runs `npm run package:win` exactly as locally, and publishes a GitHub Release tagged `vX.Y.Z` with `dist/HandyMon-Setup-X.Y.Z.exe` attached (`gh release create ... --generate-notes`).

**`.github/workflows/dev-build.yml`** — manual only (`workflow_dispatch`, run from the Actions tab against any branch). Same build steps, but sets `HANDYMON_DEV_BUILD_LABEL` (short commit SHA) so `scripts/package-win.js` visibly labels the build as a dev build everywhere a user would see it — installer filename (`HandyMon-Setup-dev-<sha>.exe`), the NSIS window title, and the Add/Remove Programs `DisplayName` all get a `(DEV BUILD <sha>)` suffix — while install path, registry key, and scheduled task name stay unchanged (`HandyMon`), so repeated dev builds overwrite the previous one in place rather than piling up separate installs. The finished installer is uploaded as a workflow-run **artifact**, not a GitHub Release — it never appears on the public Releases page. Useful both for testing the packaging pipeline itself on a clean CI machine and for handing someone a testable build without cutting a real release.

Both workflows run on `windows-latest`, which ships PowerShell + .NET Framework (covers `compile-native.js`'s `Add-Type` C# compilation, no extra setup needed) but not NSIS, hence the `choco install nsis --version=3.12.0` step in each — pinned, not "latest", for the same reason PresentMon/LHM/PawnIO are pinned in `package-win.js`: a floating version could silently change what a repeat build produces. NSIS itself is also cached across runs via `actions/cache` (`C:\Program Files (x86)\NSIS`, keyed on that pinned version — `findMakensis()` in `package-win.js` already checks that exact path as its second lookup, so a cache hit alone is enough for the build step to find it without re-running choco at all), skipping the `choco install` step entirely on a cache hit.

Both workflows also cache the bundled-tool downloads (`stageBundledTools()`'s PresentMon/LibreHardwareMonitor/PawnIO fetches, normally persisted machine-locally at `C:\HandyMon-package-cache` between local builds) across CI runs via `actions/cache`, keyed on `scripts/package-win.js`'s own content — since that's where the pinned download URLs/versions live, bumping a pin invalidates the cache automatically. Without this, every CI run is a fresh VM and would otherwise re-download all three every single time; it also means a run isn't blocked by transient GitHub Releases downtime, or broken entirely if an upstream release were ever pulled, as long as it's already cached.
