// %LOCALAPPDATA%\HandyMon — see src/utils/dirs.ts for the TypeScript-side
// equivalent. This file exists because tray-main.js/read-port.js are plain
// root-level entry points that sit outside src/ and can't import TS modules.
const os = require('os');
const path = require('path');

const CONFIG_DIR = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'HandyMon')
  : path.join(os.homedir(), 'AppData', 'Local', 'HandyMon');

module.exports = { CONFIG_DIR };
