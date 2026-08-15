import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { buildFocusByPidScript, runPsScript } from '@/utils/windows';
import { requireGrant } from '@/utils/grants';

const Body = z.object({ pid: z.number().int().positive() });

export async function POST(req: NextRequest) {
  // Focusing a window changes what's actually on screen at the host PC — its
  // own grant, distinct from both viewing and killing.
  const guard = requireGrant(req, 'processes:focus');
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  try {
    await runPsScript(buildFocusByPidScript(parsed.data.pid));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
