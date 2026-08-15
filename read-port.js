// Reads the configured port from %LOCALAPPDATA%\HandyMon\config.json,
// defaulting to 44558. Plain JS, not TypeScript — tray-main.js and server.js
// are root-level entry points that sit outside the Next.js app in src/ and
// can't import TS modules directly; src/utils/app-config.ts is the
// equivalent reader used by the rest of the app (API routes, Settings UI).
const fs = require('fs');
const path = require('path');
const { CONFIG_DIR } = require('./config-dir');

const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_PORT = 44558;

function readConfiguredPort() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    if (typeof raw.port === 'number' && raw.port >= 1 && raw.port <= 65535) return raw.port;
  } catch {}
  return DEFAULT_PORT;
}

module.exports = { readConfiguredPort, DEFAULT_PORT };
