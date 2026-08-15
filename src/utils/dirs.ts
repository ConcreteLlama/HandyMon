import { mkdirSync } from "fs";
import os from "os";
import path from "path";

// Windows convention: %LOCALAPPDATA%, not %APPDATA%/Roaming — everything
// HandyMon stores (config, paired devices, captures, logs) is specific to
// this PC, not something that should follow a roaming profile.
// process.env.LOCALAPPDATA is always set on a real Windows session; the
// homedir-based fallback only matters if it's somehow missing.
export const CONFIG_DIR = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'HandyMon')
  : path.join(os.homedir(), 'AppData', 'Local', 'HandyMon');

// cwd-independent — a packaged app's cwd isn't guaranteed to be (or be
// writable as) its own install directory, unlike a git checkout run
// directly where cwd happens to be the repo root.
export const TEMP_DIR = path.join(CONFIG_DIR, 'temp');
export const CAPTURES_DIR = path.join(CONFIG_DIR, 'captures');
export const LOG_DIR = path.join(CONFIG_DIR, 'logs');

// Bundled PresentMon (if scripts/package-win.js shipped one) — install-dir-
// relative, same resolution as NATIVE_DIR below, NOT under CONFIG_DIR: this
// is a static bundled binary, not per-user runtime data, so it belongs
// alongside native/ rather than in %LOCALAPPDATA%. presentmon.ts's
// resolveExe() checks here before falling back to CapFrameX/RTSS discovery.
export const PRESENTMON_DIR = path.join(process.env.HANDYMON_INSTALL_DIR || process.cwd(), 'presentmon');

// Same idea, for a bundled LibreHardwareMonitor (optional installer
// component — see scripts/package-win.js). Absent for a dev/git-checkout run
// or if the component was skipped at install; ensureBundledLhmRunning() in
// lhm-launch.ts checks existence before doing anything with it.
export const LHM_BUNDLED_DIR = path.join(process.env.HANDYMON_INSTALL_DIR || process.cwd(), 'LibreHardwareMonitor');

// Compiled native-interop assemblies (Add-Type-produced DLLs/exe, source in
// native-src/*.cs). These are ALWAYS precompiled ahead of time by
// scripts/compile-native.js — never at runtime, for any run mode — so this
// just needs to agree with wherever that script wrote its output:
//   - npm run dev: no entry-point script runs (bare `next dev`), so
//     HANDYMON_INSTALL_DIR is unset and this falls back to process.cwd() —
//     the repo root, for a normal `npm run dev` invocation. The predev
//     npm hook compiles there before the dev server starts.
//   - git-checkout production (tray-main.js / server.js): both set
//     HANDYMON_INSTALL_DIR to their own __dirname, i.e. the repo root —
//     the same location dev uses, populated by the prebuild hook.
//   - packaged install: tray-main.js's __dirname is the actual install
//     directory, populated by scripts/package-win.js at package time (see
//     its precompileNativeInterop step) — never written to at runtime here,
//     which matters since the install directory needs admin to write to at
//     all (RequestExecutionLevel admin).
// If the expected file isn't there, that's a real setup/build error — the
// consumers in native-audio.ts etc. throw a clear message pointing at
// `npm run compile-native` rather than trying to self-heal.
export const NATIVE_DIR = path.join(process.env.HANDYMON_INSTALL_DIR || process.cwd(), 'native');

// Same install-root resolution as NATIVE_DIR above — help.html is a root-level
// file in every run mode (repo root for dev/git-checkout, install dir for a
// packaged build), copied alongside tray-main.js by scripts/package-win.js.
export const HELP_HTML_PATH = path.join(process.env.HANDYMON_INSTALL_DIR || process.cwd(), 'help.html');

mkdirSync(TEMP_DIR, {
    recursive: true
});
