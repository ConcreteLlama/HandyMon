import { NextRequest, NextResponse } from 'next/server';
import { IdSegmentParams } from '@/types/segment-params';
import { getAppConfig } from '@/utils/app-config';
import { executeAction } from '@/utils/actions';
import { requireGrant } from '@/utils/grants';

export async function POST(req: NextRequest, segmentParams: IdSegmentParams) {
  const guard = requireGrant(req, 'actions:execute');
  if (guard) return guard;

  const { id } = await segmentParams.params;
  const config = getAppConfig();
  const action = config.actions.find(a => a.id === id);

  if (!action) {
    return NextResponse.json({ error: `Action "${id}" not found` }, { status: 404 });
  }

  try {
    const warnings = await executeAction(action, config.actions);
    return NextResponse.json({ ok: true, warnings });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
