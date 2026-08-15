import { NextRequest, NextResponse } from 'next/server';
import { listLiveDisplayDetails } from '@/utils/display-profiles';
import { requireGrant } from '@/utils/grants';
import { log } from '@/utils/logger';

export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'displayoutput:read');
  if (guard) return guard;

  try {
    const displays = await listLiveDisplayDetails();
    return NextResponse.json({ displays });
  } catch (e: any) {
    log.error('display/details threw', { error: e.message });
    return NextResponse.json({ error: e.message ?? 'Failed to read display details' }, { status: 500 });
  }
}
