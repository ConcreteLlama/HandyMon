import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { captureDisplayProfile, listDisplayProfiles } from '@/utils/display-profiles';
import { requireGrant } from '@/utils/grants';

export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'displayoutput:read');
  if (guard) return guard;

  const profiles = listDisplayProfiles().map(({ id, label }) => ({ id, label }));
  return NextResponse.json({ profiles });
}

const Body = z.object({ label: z.string().min(1), excludeTargetIds: z.array(z.number()).optional() });

// Captures the current live monitor layout and saves it as a new profile —
// the "save current setup as..." side; same grant as switching (this doesn't
// grant any capability beyond what displayoutput:write already implies).
export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'displayoutput:write');
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  try {
    const profile = await captureDisplayProfile(parsed.data.label.trim(), parsed.data.excludeTargetIds ?? []);
    return NextResponse.json({ ok: true, profile: { id: profile.id, label: profile.label } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
