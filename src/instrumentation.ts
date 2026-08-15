export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDevices } = await import('./utils/devices');
    initDevices();
    const { ensureBundledLhmRunning } = await import('./utils/lhm-launch');
    ensureBundledLhmRunning();
  }
}
