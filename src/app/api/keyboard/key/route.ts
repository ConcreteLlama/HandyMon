import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { executeHotkeyAction } from '@/utils/actions';
import { requireGrant } from '@/utils/grants';

const Body = z.object({
  keys: z.array(z.string()).min(1).max(10),
});

export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'keyboard:execute');
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    await executeHotkeyAction({ type: 'hotkey', keys: parsed.data.keys });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
