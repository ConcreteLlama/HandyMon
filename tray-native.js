// Native Windows tray icon via System.Windows.Forms.NotifyIcon — same
// pattern as src/utils/native-audio.ts / src/utils/native-display.ts, but
// this one stays running (Application.Run pumps its own message loop)
// rather than returning a value for a single call. Menu clicks are reported
// back to the parent process as plain lines on stdout so the caller doesn't
// need any IPC beyond a child process pipe.
//
// Lives alongside tray-main.js always (root of the repo in dev, root of the
// install directory in production), so its own __dirname is a reliable,
// install-dir-relative location — no HANDYMON_INSTALL_DIR indirection
// needed the way the TypeScript native-interop modules use (this file can't
// import from src/utils/dirs.ts, being plain JS outside the Next.js app).
//
// Source lives in native-src/tray-interop.cs, compiled entirely ahead of
// time by scripts/compile-native.js — never at runtime. If the DLL is
// missing, that's a real setup/build error, not something this file tries
// to fix itself.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const NATIVE_DIR = path.join(__dirname, 'native');
const DLL_PATH = path.join(NATIVE_DIR, 'tray-interop.dll');

function encodePsScript(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

/** Spawns the long-running tray process. Returns the child; caller should
 * read child.stdout line-by-line for events (OPEN_UI, PAIR, OPEN_CONFIG, HELP, QUIT)
 * and kill() it on shutdown. */
function spawnTray(iconPath) {
  if (!fs.existsSync(DLL_PATH)) {
    throw new Error(`tray-interop.dll not found at ${DLL_PATH} — run \`npm run compile-native\` first`);
  }
  const escDll = DLL_PATH.replace(/\\/g, '\\\\');
  const escIcon = iconPath.replace(/\\/g, '\\\\');
  const script = `$ProgressPreference = 'SilentlyContinue'\nAdd-Type -Path "${escDll}"\n[HandyMonTray.Api]::Run("${escIcon}")`;
  return spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodePsScript(script)], {
    windowsHide: true,
  });
}

module.exports = { spawnTray };
