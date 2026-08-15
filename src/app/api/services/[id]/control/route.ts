import { NextRequest, NextResponse } from 'next/server';
import { IdSegmentParams } from '@/types/segment-params';
import { getServiceConfig, controllerFor } from '@/utils/services';
import { requireGrant } from '@/utils/grants';

// Two independent gates must both pass: the device needs services:control,
// AND the admin must have flagged this specific service as controllable
// (allowControl) — a device with the grant still can't touch a monitor-only
// service.
export async function POST(req: NextRequest, segmentParams: IdSegmentParams) {
  const guard = requireGrant(req, 'services:control');
  if (guard) return guard;

  const { id } = await segmentParams.params;
  const cfg = getServiceConfig(id);
  if (!cfg) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  if (!cfg.allowControl) return NextResponse.json({ error: 'This service is monitor-only' }, { status: 403 });

  const action = req.nextUrl.searchParams.get('action');
  if (action !== 'start' && action !== 'stop' && action !== 'restart') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const controller = controllerFor(cfg);
  const command = action === 'start' ? () => controller.start(10000) : action === 'stop' ? () => controller.stop(10000) : controller.restart;

  try {
    const result = await command();
    return NextResponse.json({ ok: true, action, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, action, error: e.message ?? String(e) }, { status: 500 });
  }
}
