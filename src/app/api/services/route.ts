import { NextRequest, NextResponse } from 'next/server';
import { listServiceConfigs, controllerFor } from '@/utils/services';
import { requireGrant } from '@/utils/grants';

// List every host-admin-configured service + its live running status.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'services:read');
  if (guard) return guard;

  const configs = listServiceConfigs();
  const services = await Promise.all(configs.map(async cfg => {
    const running = await controllerFor(cfg).isRunning();
    return { id: cfg.id, label: cfg.label, allowControl: cfg.allowControl, running };
  }));
  return NextResponse.json({ services });
}
