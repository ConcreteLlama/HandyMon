import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { encodePsScript } from '@/utils/windows';
import { requireGrant } from '@/utils/grants';

const execAsync = promisify(exec);

const GUID_MAP: Record<string, string> = {
  '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}': `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32`,
  '{6D809377-6AF0-444B-8957-A3773F02200E}': process.env.ProgramFiles ?? 'C:\\Program Files',
  '{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}': process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
  '{D65231B0-B2F1-4857-A4CE-A8E7C6EA7D27}': `${process.env.SystemRoot ?? 'C:\\Windows'}\\SysWOW64`,
  '{F38BF404-1D43-42F2-9305-67DE0B28FC23}': process.env.SystemRoot ?? 'C:\\Windows',
};

export interface InstalledApp {
  name: string;
  program: string;
  args: string[];
  type: 'exe' | 'uwp' | 'protocol';
  displayPath: string;
}

function resolveApp(name: string, appId: string): InstalledApp | null {
  // GUID-prefixed path (e.g. {GUID}\\Some\\App.exe)
  const guidMatch = appId.match(/^\{([^}]+)\}\\(.+)$/);
  if (guidMatch) {
    const guid = `{${guidMatch[1]}}`;
    const rest = guidMatch[2];
    const base = GUID_MAP[guid];
    if (!base) return null;
    const fullPath = `${base}\\${rest}`;
    if (!fullPath.toLowerCase().endsWith('.exe')) return null;
    return { name, program: fullPath, args: [], type: 'exe', displayPath: fullPath };
  }

  // Protocol URL (steam://, uplay://, etc.)
  if (appId.includes('://')) {
    const scheme = appId.split('://')[0];
    return { name, program: 'explorer.exe', args: [appId], type: 'protocol', displayPath: scheme + '://' };
  }

  // Plain absolute path (e.g. C:\Users\...\App.exe) — some Win32 apps register
  // a Start Menu shortcut this way instead of a GUID-prefixed known-folder
  // path (seen for apps installed outside Program Files/System32/etc).
  if (/^[a-zA-Z]:\\/.test(appId) && appId.toLowerCase().endsWith('.exe')) {
    return { name, program: appId, args: [], type: 'exe', displayPath: appId };
  }

  // UWP / Store / Squirrel — launch via shell:AppsFolder
  return { name, program: 'explorer.exe', args: [`shell:AppsFolder\\${appId}`], type: 'uwp', displayPath: appId };
}

export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'actions:edit');
  if (guard) return guard;

  const script = 'Get-StartApps | ConvertTo-Json -Compress';
  const { stdout } = await execAsync(
    `powershell -NoProfile -NonInteractive -EncodedCommand ${encodePsScript(script)}`,
    { maxBuffer: 4 * 1024 * 1024 }
  );

  const raw: Array<{ Name: string; AppID: string }> = JSON.parse(stdout.trim());
  const apps = raw
    .map(r => resolveApp(r.Name, r.AppID))
    .filter((a): a is InstalledApp => a !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ apps });
}
