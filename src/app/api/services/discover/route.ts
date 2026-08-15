import { NextRequest, NextResponse } from 'next/server';
import { localhostOnly } from '@/utils/request-utils';
import { runPsScriptJson } from '@/utils/windows';

// PowerShell's Get-Service Status serializes as ServiceControllerStatus's
// underlying int, not a friendly string.
const STATUS_NAMES: Record<number, string> = {
  1: 'Stopped', 2: 'StartPending', 3: 'StopPending', 4: 'Running',
  5: 'ContinuePending', 6: 'PausePending', 7: 'Paused',
};

// Lists installed Windows services or scheduled tasks (whichever the admin is
// configuring), for the "add a service" picker in Settings. Host-only — this
// is a config-authoring tool, not something a paired device ever needs.
export async function GET(req: NextRequest) {
  const guard = localhostOnly(req);
  if (guard) return guard;

  const type = req.nextUrl.searchParams.get('type') === 'task' ? 'task' : 'service';

  try {
    if (type === 'service') {
      const raw = await runPsScriptJson<unknown>('Get-Service | Select-Object Name,DisplayName,Status | ConvertTo-Json -Compress');
      const list = (Array.isArray(raw) ? raw : [raw]) as { Name: string; DisplayName: string; Status: number }[];
      const services = list
        .map(s => ({ name: s.Name, displayName: s.DisplayName, status: STATUS_NAMES[s.Status] ?? String(s.Status) }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
      return NextResponse.json({ services });
    }

    const raw = await runPsScriptJson<unknown>(`Get-ScheduledTask | Select-Object TaskName,@{N='State';E={$_.State.ToString()}} | ConvertTo-Json -Compress`);
    const list = (Array.isArray(raw) ? raw : [raw]) as { TaskName: string; State: string }[];
    const services = list
      .map(t => ({ name: t.TaskName, displayName: t.TaskName, status: t.State }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
    return NextResponse.json({ services });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
