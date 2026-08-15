import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Run a PowerShell command with no console window (prevents focus stealing)
function runPS(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { windowsHide: true, stdio: 'pipe' }
    );
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `Exit ${code}`)));
    child.on('error', reject);
  });
}

// Inject text into the focused window via clipboard paste.
// Text is written to a temp file to avoid any PowerShell string-escaping issues.
export async function typeText(text: string): Promise<void> {
  if (!text) return;

  const tmp = path.join(os.tmpdir(), `pc-kbd-${process.hrtime.bigint()}.txt`);
  fs.writeFileSync(tmp, text, 'utf8');

  const escapedTmp = tmp.replace(/\\/g, '\\\\');
  try {
    await runPS(
      `$t = [System.IO.File]::ReadAllText('${escapedTmp}', [Text.Encoding]::UTF8); ` +
      `Set-Clipboard -Value $t; ` +
      `Start-Sleep -Milliseconds 80; ` +
      `(New-Object -ComObject WScript.Shell).SendKeys('^v')`
    );
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}
