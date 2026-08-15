import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { requireGrant } from '@/utils/grants';

const Body = z.object({
  type: z.enum(['rtss', 'fanControl', 'processLasso']),
  path: z.string(),
});

const CHECKS: Record<string, (p: string) => string> = {
  rtss:                   p => path.join(p, 'RTSS.exe'),
  fanControl:             p => path.join(p, 'FanControl.exe'),
  processLasso:           p => path.join(p, 'config'),
};

export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'settings:write');
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const checkPath = CHECKS[parsed.data.type](parsed.data.path);
  const exists = fs.existsSync(checkPath);
  return NextResponse.json({ ok: exists, checkedPath: checkPath });
}
