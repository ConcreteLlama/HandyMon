import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runPsScriptJson } from '@/utils/windows';
import { requireGrant } from '@/utils/grants';

const Body = z.object({ pid: z.number().int().positive() });

// Graceful close (posts WM_CLOSE via CloseMainWindow, same as clicking the
// window's X) — as opposed to /api/windows/kill's force-terminate. Only works
// on a process with a real main window; returns closed:false otherwise.
export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'processes:kill');
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  try {
    const closed = await runPsScriptJson<boolean>(
      `$p = Get-Process -Id ${parsed.data.pid} -ErrorAction Stop; $p.CloseMainWindow() | ConvertTo-Json -Compress`,
      5000,
    );
    return NextResponse.json({ ok: true, closed });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
