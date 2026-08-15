import { NextRequest, NextResponse } from 'next/server';
import { requireGrant } from '@/utils/grants';
import { runPsScriptJson } from '@/utils/windows';
import { log } from '@/utils/logger';

// process.uptime() is HandyMon's own server process — always available, no
// shell-out needed. System boot time needs WMI (no equivalent Node API), so
// that half is best-effort: if it fails, the client just doesn't show it
// rather than failing the whole response.
async function getSystemBootTimeIso(): Promise<string | null> {
  try {
    const result = await runPsScriptJson<{ bootTimeIso: string }>(
      '[PSCustomObject]@{ bootTimeIso = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToString("o") } | ConvertTo-Json'
    );
    return result.bootTimeIso;
  } catch (e: any) {
    log.warn('Failed to read system boot time', { error: e.message });
    return null;
  }
}

export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'settings:read');
  if (guard) return guard;

  const systemBootTimeIso = await getSystemBootTimeIso();
  return NextResponse.json({
    handyMonUptimeSec: process.uptime(),
    systemBootTimeIso,
  });
}
