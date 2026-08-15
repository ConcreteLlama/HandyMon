// Production entry point — tray icon + embedded Next server, no Electron.
// Replaces electron-main.js: "Open UI" and "Pair new device" open the
// system's default browser instead of an embedded Chromium BrowserWindow,
// since neither of those two actions ever rendered anything that needed an
// embedded browser engine in the first place — the dashboard itself is
// always viewed in the user's own browser (phone or desktop), never inside
// this process. The only thing that genuinely needed a native API was the
// tray icon itself, which tray-native.js provides via a compiled
// System.Windows.Forms.NotifyIcon (Add-Type), not Electron's Tray class.

const path = require('path');
const { exec } = require('child_process');
const { guardRequest } = require('./server-guard');
const { spawnTray } = require('./tray-native');
const { readConfiguredPort } = require('./read-port');
const { CONFIG_DIR } = require('./config-dir');

// Tells src/utils/dirs.ts (via the Next.js server this process starts below)
// where compiled native-interop assemblies actually live: install-dir-
// relative, precompiled once at package time — see scripts/package-win.js —
// rather than the dev-only lazily-compiled fallback dirs.ts uses when this
// is unset (npm run dev never goes through this file at all, so it's
// naturally unset there). Must be set before anything that might import
// dirs.ts gets required, hence right at the top.
process.env.HANDYMON_INSTALL_DIR = __dirname;

const portArg = process.argv.slice(2).find(a => a.startsWith('--port='));
const PORT = portArg ? Number(portArg.split('=')[1]) : readConfiguredPort();
const ICON_PATH = path.join(__dirname, 'handymon.png');
const HELP_PATH = path.join(__dirname, 'help.html');

function openUrl(url) {
  exec(`start "" "${url}"`);
}

function openFolder(dir) {
  exec(`start "" "${dir}"`);
}

async function startNextServer() {
  const next = require('next');
  const http = require('http');
  const nextApp = next({ dev: false, dir: path.join(__dirname) });
  await nextApp.prepare(); // instrumentation.ts runs here — loads device registrations
  const handler = nextApp.getRequestHandler();
  const server = http.createServer((req, res) => {
    if (guardRequest(req, res)) return;
    handler(req, res);
  });
  // A bind failure (e.g. port already in use) is an async 'error' event, not
  // a throw or a rejected .listen() call — without this it becomes an
  // uncaught exception instead of something main() can try/catch.
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, () => {
      server.removeListener('error', reject);
      console.log(`Next.js server started on port ${server.address().port}`);
      resolve();
    });
  });
  return server;
}

async function main() {
  await startNextServer();

  const tray = spawnTray(ICON_PATH);
  let buffer = '';

  tray.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      // PowerShell serializes some streams (progress, warning) as CLIXML
      // even with -NonInteractive; ignore anything that isn't one of our
      // own known event lines rather than trying to fully suppress it.
      if (line === 'OPEN_UI') openUrl(`http://localhost:${PORT}`);
      else if (line === 'PAIR') openUrl(`http://localhost:${PORT}/pair`);
      else if (line === 'OPEN_CONFIG') openFolder(CONFIG_DIR);
      else if (line === 'HELP') openUrl(HELP_PATH);
      else if (line === 'QUIT') process.exit(0);
    }
  });

  tray.on('exit', (code) => {
    console.log('[tray-main] tray process exited', code);
    process.exit(0);
  });
  tray.on('error', (err) => {
    console.error('[tray-main] failed to spawn tray process', err);
    process.exit(1);
  });

  process.on('exit', () => {
    try { tray.kill(); } catch {}
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[tray-main] fatal', err);
    process.exit(1);
  });
}
