import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { typeText } from '@/utils/virtual-keyboard';
import { requireGrant } from '@/utils/grants';

const Body = z.object({
  text: z.string().min(1).max(10_000),
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
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await typeText(parsed.data.text);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
