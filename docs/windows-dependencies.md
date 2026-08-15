# Windows Dependencies

All external tools and their default paths. Most of these are user-configurable (Settings → Tool Paths / Performance Monitoring) — the paths below are just the defaults a fresh install falls back to. These tools must exist on the machine for their respective features to work.

## Tool Summary

| Tool | Purpose | Default Path | Defined In |
|------|---------|----------------|------------|
| RivaTuner Statistics Server | GPU framerate limiting per game | `C:\Program Files (x86)\RivaTuner Statistics Server` | `src/config.ts` |
| FanControl | Fan profile management | `C:\Program Files (x86)\FanControl\` | `src/utils/fan-control.ts` |
| Process Lasso | CPU affinity config file | `C:\ProgramData\ProcessLasso` | `src/config.ts` |
| LibreHardwareMonitor (+ PawnIO driver) | Hardware sensors: CPU/GPU temp, power, clocks, VRAM, VRM temp, fans | HTTP `localhost:8085/data.json` (no path) | `src/utils/lhm.ts` |
| PresentMon (ETW) | In-game FPS / frametimes / 1% lows / hitches | auto-detected, or set in Settings | `src/utils/presentmon.ts` |

## Detail

### RivaTuner Statistics Server (RTSS)

- **Install path:** `C:\Program Files (x86)\RivaTuner Statistics Server` — configurable in Settings → Tool Paths
- **Profiles directory:** `<install path>\Profiles\` — `.cfg` files (INI format), one per game plus a `Global`
- **Executable:** `<install path>\RTSS.exe`
- **Start/stop:** direct process spawn/kill (`spawn(RTSS_EXE, ...)` / `Stop-Process -Name RTSS`) — not a scheduled task. RTSS doesn't register one itself, and HandyMon's own process already runs elevated, so there's no privilege gap a scheduled task would bridge.
- **Config source:** `src/config.ts` → `CONFIG.rtss.installPath` → `getAppConfig().rtssInstallPath`. Note: `RTSS_INSTALL_PATH` is read once at module load (not per-call like FanControl's `getFanControlDir()`), so changing this path in Settings needs an app restart to take effect.
- **Used by:** `src/utils/rtss.ts`

### FanControl

- **Install path:** `C:\Program Files (x86)\FanControl\` — configurable in Settings → Tool Paths
- **Executable:** `FanControl.exe` — called with `--config <profile.json>` to switch profiles
- **Profiles directory:** `<install path>\Configurations\` — `.json` files, one per profile
- **Cache file:** `<install path>\Configurations\CACHE` — JSON, records the last-used profile
- **Config source:** `src/utils/fan-control.ts` → `getAppConfig().fanControlPath`, read fresh on every call — a Settings change takes effect immediately, no restart needed.
- **Used by:** `src/utils/fan-control.ts`

### ~~SoundVolumeView~~ — replaced by native Core Audio COM interop

No longer an external dependency. Audio device listing, default-device switching, and volume control now go through Windows' own `IMMDeviceEnumerator`/`IAudioEndpointVolume` (documented) and `IPolicyConfig::SetDefaultEndpoint` (undocumented but stable on Win10/11 — the same mechanism SoundVolumeView itself used internally). Implemented in `src/utils/native-audio.ts`: C# source in `native-src/audio-interop.cs`, compiled ahead of time by `scripts/compile-native.js` (see [startup.md](startup.md#native-interop-compilation)) into a DLL that's loaded via `Add-Type -Path` and invoked from PowerShell.

### Process Lasso

- **Config directory:** `C:\ProgramData\ProcessLasso` — configurable in Settings → Tool Paths
- **Config file:** `config\prolasso.ini` within that directory (INI format, UTF-16 with BOM)
- **Config source:** `src/config.ts` → `CONFIG.processLasso.configPath` → `getAppConfig().processLassoConfigPath`. Like RTSS, `PROCESS_LASSO_CONFIG_FILE` is read once at module load, so a Settings change needs an app restart to take effect.
- **Used by:** `src/utils/proces-lasso/process-lasso-config.ts`
- **Note:** Process Lasso must be installed and have been run at least once to create the config file

### Services (generic Windows service / scheduled task control)

- **No hardcoded path or tool** — this is a generic feature, not tied to any specific external program. An admin configures any Windows service or scheduled task by name in Settings (`ServicesConfigSection`); each entry is controlled via `net start`/`net stop` (services) or `schtasks /run`/`schtasks /end` (tasks).
- **Used by:** `src/utils/services.ts`, `src/utils/service.ts`, `src/utils/service-controller-route.ts`

### ~~MonitorSwitcher~~ — replaced by native CCD API interop

No longer an external dependency. Monitor-layout capture and switching now go through Windows' own CCD (Connecting and Configuring Displays) API — `QueryDisplayConfig` to capture the current layout, `SetDisplayConfig` to reapply a saved one, both documented public Win32 APIs. Profiles are still capture-then-reapply (arrange your monitors, then "Capture Current Setup" in the Output tab) — same workflow MonitorSwitcher itself used, just without the external tool. Implemented in `src/utils/native-display.ts` (same precompiled-C# pattern as the audio replacement, source in `native-src/display-interop.cs`); saved profiles live in `AppConfig.displayProfiles`, not a separate XML directory. Struct layouts and the LUID-remap-at-apply-time approach (adapter LUIDs go stale across reboots/driver restarts) are adapted from [mastersign/Mastersign.DisplayManager](https://github.com/mastersign/Mastersign.DisplayManager) (MIT).
- **Used by:** `src/utils/display-profiles.ts`, `src/utils/native-display.ts`

### LibreHardwareMonitor + PawnIO (for temperature / power / clock / fan data)

The performance section works standalone on Windows Performance Counters (native, no setup) for CPU/GPU usage, RAM and VRAM. Hardware sensors — CPU & GPU temperature, power, clocks, VRAM total, motherboard VRM temp, fan RPMs — come from **LibreHardwareMonitor (LHM)**:

**Bundled by default in the packaged installer** (`scripts/package-win.js`'s "LibreHardwareMonitor + PawnIO driver" optional component — checked by default on a fresh install, or whatever `bundledLhm` in an existing `config.json` says on a reinstall, see [startup.md](startup.md#packaged--installed-build)) — a dedicated copy is extracted to `$INSTDIR\LibreHardwareMonitor\`, pre-configured (its own `LibreHardwareMonitor.config`, Remote Web Server enabled, on a **distinct port from the ecosystem default** — `LHM_BUNDLED_PORT` in `package-win.js`, currently 8286 — so it can't collide with a separately-run LHM instance) and started automatically by `src/utils/lhm-launch.ts`'s `ensureBundledLhmRunning()` (called from `src/instrumentation.ts` at server startup, same "spawn directly, check by process name first" pattern as RTSS in `rtss.ts`). The installer also writes `bundledLhm` (`AppConfig`, always both branches) and that port into `config.json`'s `lhmPort` (only when this component was actually selected, so a skip-bundling install keeps the ecosystem-default 8085). The LHM component's Section stops any running bundled LibreHardwareMonitor before copying over it, and the Uninstall section does the same before deleting — otherwise `File /r` (reinstall) or `RMDir /r` (uninstall) would fail against a locked exe, since `ensureBundledLhmRunning()` means it's very likely running by the time either happens. Both LHM's and PawnIO's licenses (MPL 2.0 / GPLv2) permit this: unmodified binaries redistributed as separate programs, not linked into HandyMon itself.

Manual setup (git-checkout runs, or if the bundled component was skipped):

1. **LibreHardwareMonitor** — install path `C:\Program Files\LibreHardwareMonitor\` (portable ZIP from https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases). Run **elevated**, then enable **Options → Remote Web Server** on port **8085**. The app reads `http://localhost:<port>/data.json` and auto-detects it; if LHM isn't running, the perf section falls back to native counters (usage only, no temps). Parser: `src/utils/lhm.ts`. The status dot in the perf UI reflects this connection. **The port is configurable** in Settings → Performance Monitoring (`lhmPort` in config, default 8085), with a server-side "test" button (`/api/perf/lhm-test`) so remote devices can verify the host's connection without reaching the LHM port directly.

2. **PawnIO** — **required kernel driver** for LHM's low-level (ring-0) reads: **CPU SMU** (package temp/power/clocks) and **motherboard Super-I/O** (VRM temp, fans). Install from https://pawnio.eu (signed, HVCI / Memory-Integrity compatible — no need to disable Core Isolation). Without a working PawnIO, LHM returns `0` for all CPU and motherboard sensors while GPU/disk/network still work. Verify with `sc query PawnIO` (the service must exist and be running). FanControl uses the same driver, so a broken PawnIO breaks both. The installer's silent install (`PawnIO_setup.exe -install -silent`) is never run again on uninstall — other tools (e.g. FanControl) can share the same system driver, so HandyMon's own uninstaller deliberately leaves it in place.

### PresentMon (for in-game FPS / frametimes)

FPS, frametimes, avg, 1% / 0.1% lows, min/max and hitches come from **PresentMon** (Intel, MIT-licensed) — an **ETW** frametime capture (no injection, no RTSS). Requires the host process to run **elevated** for the realtime ETW session (the "HandyMon" task runs `HighestAvailable`, so this is satisfied).

**Bundled by default in the packaged installer** — a version-pinned, known-CLI-compatible build (v2.5.1; see `PRESENTMON_URL` in `scripts/package-win.js` — pinned rather than "latest" so a future release can't silently break the CLI args without someone verifying first) is staged to `$INSTDIR\presentmon\PresentMon.exe`. `resolveExe()` in `src/utils/presentmon.ts` checks there (`PRESENTMON_DIR` in `dirs.ts`, install-dir-relative) before falling back to CapFrameX/RTSS discovery. Optional component — checked by default on a fresh install, or whatever `bundledPresentMon` in an existing `config.json` says on a reinstall (see the LHM section above and [startup.md](startup.md#packaged--installed-build)).

- **Manager:** `src/utils/presentmon.ts` — a singleton that spawns a persistent PresentMon capture (`--v1_metrics --output_stdout` for 2.x, `-output_stdout -captureall` for 1.x), streams the CSV, and keeps a rolling per-process frametime buffer. It runs **only while the Frame page is polling** (`/api/perf/fps`) and idle-stops ~30s after.
- **Binary:** bundled copy first, then auto-discovered from CapFrameX / RTSS plugin dirs, or set explicitly in **Settings → Frame Rate (PresentMon)** (`presentMonPath`), with a server-side test button (`/api/perf/presentmon-test`) and a "Show diagnostic" panel (`diagnosticProbePresentMon()`) for a deterministic one-shot spawn+probe when Test isn't enough to tell what's wrong.
- **Active process** = the top non-excluded presenter (dwm/explorer/etc. filtered); its name shows on the Frame page.
- **Tuning** (Frame page popover, persisted to config): `fpsPollMs` (refresh rate), `fpsWindowMs` (instantaneous-FPS smoothing), `fpsGraphSeconds` (graph time window).
- FPS is served by the lightweight in-memory `/api/perf/fps` endpoint, decoupled from the slower `/api/perf/stats` sensor poll.
- **DLSS4 flip-metering:** NVIDIA's flip-metering support (`msBetweenDisplayChange` reflecting true on-screen flip cadence) is an upstream contribution to the same MIT-licensed PresentMon project (github.com/GameTechDev/PresentMon PR #440), merged into official releases starting at v2.4.0 — not a separate proprietary fork. The bundled v2.5.1 build already reports it under `--v1_metrics` (confirmed directly against a real 2.5.1 binary, not assumed from the changelog); `flipMeteringSupported` on `GpuFramerate`/the diagnostic probe reports whether the resolved build's CSV header actually includes that column, surfaced on both the FPS page's FRAME GEN tile and the Settings diagnostic panel. `--v2_metrics` exists too but uses an incompatible column schema (`FrameTime`/`CPUBusy`/`DisplayLatency` instead of `msBetweenPresents`/`msUntilDisplayed`/`msBetweenDisplayChange`) for no capability v1 doesn't already cover — not used.

## Windows Built-ins Used

| Command | Purpose | Used In |
|---------|---------|---------|
| `schtasks` | Start/stop/create scheduled tasks | `src/utils/service.ts`, npm scripts |
| `net start/stop` | Control Windows services | `src/utils/service.ts` |
| `tasklist /FI` | Check if a process is running by name | `src/utils/service.ts` |
| PowerShell `Get-Process` | List running processes with CPU stats | `src/utils/processes.ts` |
| PowerShell `Get-Counter` | CPU per-core %, GPU util %, RAM, VRAM | `src/utils/perf.ts` |
| WMI `Win32_Processor` / `Win32_OperatingSystem` | CPU core count, total RAM | `src/utils/perf.ts` |
