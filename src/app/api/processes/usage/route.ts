import { NextRequest, NextResponse } from 'next/server';
import { getProcessUsage } from '@/utils/processes';
import { requireGrant } from '@/utils/grants';

// Per-PID CPU% + RAM for all processes (fast WMI perf counters).
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'processes:read');
  if (guard) return guard;
  return NextResponse.json({ usage: await getProcessUsage() });
}
