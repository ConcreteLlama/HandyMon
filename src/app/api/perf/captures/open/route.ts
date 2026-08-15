import { NextRequest, NextResponse } from 'next/server';
import { openWithCapFrameX, capFrameXAvailable } from '@/utils/captures';
import { requireGrant } from '@/utils/grants';

// Host-side: launch CapFrameX with the capture CSV. GET reports availability.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'perf:read');
  if (guard) return guard;
  return NextResponse.json({ available: capFrameXAvailable() });
}

export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'perf:capture');
  if (guard) return guard;

  const file = req.nextUrl.searchParams.get('file') ?? '';
  const result = openWithCapFrameX(file);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
