import { NextRequest, NextResponse } from 'next/server';
import { restartPresentMon, presentMonAvailable } from '@/utils/presentmon';
import { requireGrant } from '@/utils/grants';

// Kill + respawn the streaming PresentMon capture (config change / recovery).
export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'settings:write');
  if (guard) return guard;
  restartPresentMon();
  return NextResponse.json({ ok: true, available: presentMonAvailable() });
}
