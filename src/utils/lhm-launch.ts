import { existsSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { listRunningProcessNames } from './processes';
import { LHM_BUNDLED_DIR } from './dirs';
import { log } from './logger';

const LHM_BUNDLED_EXE = path.join(LHM_BUNDLED_DIR, 'LibreHardwareMonitor.exe');

// Launches the bundled LibreHardwareMonitor (if the optional installer
// component was included — see scripts/package-win.js) at server startup, so
// hardware sensors work out of the box without the manual "download LHM, run
// elevated, enable Remote Web Server" steps documented in help.html#lhm. Its
// own config (LibreHardwareMonitor.config, written by the installer next to
// the bundled exe) already has the web server enabled and pointed at a
// distinct port (see dirs.ts's LHM_BUNDLED_DIR comment) — this just needs to
// get the process running, same as the RTSS direct-launch pattern in rtss.ts.
export async function ensureBundledLhmRunning(): Promise<void> {
  if (!existsSync(LHM_BUNDLED_EXE)) return; // not bundled — dev/git-checkout run, or the user skipped this component
  const running = await listRunningProcessNames();
  // Covers both "our bundled copy is already running" (e.g. a quick restart)
  // and "the user has their own separate LHM install running" — either way,
  // starting a second instance would just fail to bind its port.
  if (running.some(name => name.toLowerCase() === 'librehardwaremonitor')) return;
  try {
    const child = spawn(LHM_BUNDLED_EXE, [], { cwd: LHM_BUNDLED_DIR, detached: true, stdio: 'ignore' });
    child.unref();
    log.info('Launched bundled LibreHardwareMonitor');
  } catch (e) {
    log.warn('Failed to launch bundled LibreHardwareMonitor', { error: String(e) });
  }
}
