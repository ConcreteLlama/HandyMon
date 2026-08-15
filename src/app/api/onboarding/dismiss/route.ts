import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dismissTips } from '@/utils/onboarding';
import { localhostOnly } from '@/utils/request-utils';

const Body = z.object({
  // tipId -> version being acknowledged. One tip for a plain "Dismiss", every
  // tip in a section for "Dismiss This Section", every known tip for
  // "Dismiss All" — the client (which owns the tip registry) decides the
  // scope by how many entries it sends; this route treats them identically.
  versions: z.record(z.string(), z.number()),
});

export async function POST(req: NextRequest) {
  const guard = localhostOnly(req);
  if (guard) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  dismissTips(parsed.data.versions);
  return NextResponse.json({ ok: true });
}
