import { NextRequest, NextResponse } from 'next/server';
import { IdSegmentParams } from '@/types/segment-params';
import { describeDisplayProfile } from '@/utils/display-profiles';
import { requireGrant } from '@/utils/grants';
import { log } from '@/utils/logger';

export async function GET(req: NextRequest, segmentParams: IdSegmentParams) {
  const guard = requireGrant(req, 'displayoutput:read');
  if (guard) return guard;

  const { id } = await segmentParams.params;
  try {
    const displays = await describeDisplayProfile(id);
    if (!displays) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    return NextResponse.json({ displays });
  } catch (e: any) {
    log.error('display/profiles/[id]/details threw', { id, error: e.message });
    return NextResponse.json({ error: e.message ?? 'Failed to read profile details' }, { status: 500 });
  }
}
