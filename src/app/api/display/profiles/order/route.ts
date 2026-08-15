import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { reorderDisplayProfiles } from '@/utils/display-profiles';
import { requireGrant } from '@/utils/grants';

const Body = z.object({ ids: z.array(z.string()) });

// Whole-list reorder (drag-and-drop) — one call per drop with the full new
// order, rather than a single-step up/down.
export async function PUT(req: NextRequest) {
  const guard = requireGrant(req, 'displayoutput:write');
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const profiles = reorderDisplayProfiles(parsed.data.ids).map(({ id, label }) => ({ id, label }));
  return NextResponse.json({ ok: true, profiles });
}
