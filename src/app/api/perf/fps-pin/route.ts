import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pinPresentMonProcess } from '@/utils/presentmon';
import { requireGrant } from '@/utils/grants';

const Body = z.object({
  key: z.string().min(1),
  displayName: z.string().min(1),
  pid: z.number().int().positive().nullable(),
});

// Manually pins the live FPS view to one process — see the "process picker"
// in FrameToolbar, sourced from GET /api/perf/fps-candidates.
export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'perf:capture');
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  pinPresentMonProcess(parsed.data.key, parsed.data.displayName, parsed.data.pid);
  return NextResponse.json({ ok: true });
}
