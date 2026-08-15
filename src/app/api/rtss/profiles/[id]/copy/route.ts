import { IdSegmentParams } from '@/types/segment-params';
import { copyRtssProfile, setRtssLimit } from '@/utils/rtss';
import { NextRequest, NextResponse } from 'next/server';
import { requireGrant } from '@/utils/grants';

export async function POST(req: NextRequest, segmentParams: IdSegmentParams) {
  const guard = requireGrant(req, 'gaming:write');
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const destinationProfile = searchParams.get('to');
  const params = await segmentParams.params;
  const fromId = params.id;
  try {
    if (!destinationProfile) {
      throw new Error(`to param must be specified`)
    }
    await copyRtssProfile(fromId, destinationProfile);

    return NextResponse.json({
      ok: true,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: 'Failed to update RTSS config',
      details: String(err),
    }, { status: 500 });
  }
}