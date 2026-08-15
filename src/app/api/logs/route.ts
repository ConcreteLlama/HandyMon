import { NextRequest, NextResponse } from 'next/server';
import { localhostOnly } from '@/utils/request-utils';
import { readLogTail } from '@/utils/logger';

// Host-only — the log can contain host paths, script previews, and other
// detail not meant for remote devices, and it exists specifically to debug
// this machine, not to be a remote-monitorable feature.
export async function GET(req: NextRequest) {
  const guard = localhostOnly(req);
  if (guard) return guard;

  const lines = Number(req.nextUrl.searchParams.get('lines')) || 500;
  return NextResponse.json({ lines: readLogTail(lines) });
}
