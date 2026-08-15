import { NextRequest, NextResponse } from 'next/server';
import { WindowInfo } from '@/types/windows';
import { queryNativeWorker } from '@/utils/native-worker';
import { requireGrant } from '@/utils/grants';
import { log } from '@/utils/logger';

// Enumerate visible windows: processes that have a non-empty main window.
// Runs through the persistent native worker (see native-worker.ts) instead
// of spawning PowerShell — window titles can contain raw control characters
// (seen live: a VS Code tab title with an embedded control char broke every
// poll until that window closed, since PowerShell's ConvertTo-Json doesn't
// reliably escape the full C0 control range) — the worker's real JSON
// serializer escapes them correctly instead of needing to strip them.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'processes:read');
  if (guard) return guard;

  try {
    const data = await queryNativeWorker<any[]>('windows', 8000);
    const windows: WindowInfo[] = (data ?? []).map((w: any) => ({
      pid: w.pid,
      processName: w.processName,
      title: w.title,
      path: w.path ?? null,
    }));
    return NextResponse.json(windows);
  } catch (err) {
    log.debug('windows/list: falling back to empty list', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json([] as WindowInfo[]);
  }
}
