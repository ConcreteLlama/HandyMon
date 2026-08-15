import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/utils/app-config';
import { requireGrant } from '@/utils/grants';

export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'actions:edit');
  if (guard) return guard;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });

  const config = getAppConfig();
  const referencedBy = config.actions
    .filter(a => a.steps.some(step => step.type === 'macro' && step.macroId === id))
    .map(a => a.name);

  return NextResponse.json({ ok: referencedBy.length === 0, referencedBy });
}
