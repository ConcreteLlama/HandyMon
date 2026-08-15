import { NextRequest, NextResponse } from 'next/server';
import { fetchLhmSensorGroups } from '@/utils/lhm';
import { requireGrant } from '@/utils/grants';

// Full LHM sensor lists (temperatures / powers / fans / controls) for the
// Temps / Fans / Power tabs — one LHM fetch serves all three.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'perf:read');
  if (guard) return guard;
  const groups = await fetchLhmSensorGroups();
  return NextResponse.json({ timestamp: Date.now(), available: groups !== null, groups });
}
