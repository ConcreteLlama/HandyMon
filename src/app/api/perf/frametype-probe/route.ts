import { NextRequest, NextResponse } from 'next/server';
import { probeFrameType } from '@/utils/presentmon';
import { requireGrant } from '@/utils/grants';

// One-off diagnostic: run a short --track_frame_type capture and report the
// header + a few sample rows, to check real FrameType coverage before
// committing to the full v1->v2 schema switch.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'settings:write');
  if (guard) return guard;
  const result = await probeFrameType(5);
  return NextResponse.json(result);
}
