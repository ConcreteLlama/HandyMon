// Guarded standalone server entry point — the headless alternative to the
// tray wrapper (see tray-main.js). Both share server-guard.js so the
// Host-header-spoofing protection applies no matter which way HandyMon is
// run. Replaces bare `next start`, which had no way to apply that guard.
//
// Usage: `node server.js` (production, configured port — see read-port.js)
//        `node server.js --dev --port=3000` (development)
const http = require('http');
const path = require('path');
const { guardRequest } = require('./server-guard');
const { readConfiguredPort } = require('./read-port');

// dirs.ts's NATIVE_DIR resolves via HANDYMON_INSTALL_DIR when set — must be
// set before requiring next/the app, matching tray-main.js.
process.env.HANDYMON_INSTALL_DIR = __dirname;

const args = process.argv.slice(2);
const dev = args.includes('--dev');
const portArg = args.find(a => a.startsWith('--port='));
const port = portArg ? Number(portArg.split('=')[1]) : (dev ? 3000 : readConfiguredPort());

async function main() {
  const next = require('next');
  const app = next({ dev, dir: path.join(__dirname) });
  await app.prepare();
  const handler = app.getRequestHandler();

  const server = http.createServer((req, res) => {
    if (guardRequest(req, res)) return;
    handler(req, res);
  });

  server.listen(port, () => {
    console.log(`HandyMon server ready on http://localhost:${port} (${dev ? 'development' : 'production'})`);
  });
}

main();
