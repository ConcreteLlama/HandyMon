import { NextRequest, NextResponse } from 'next/server';
import { getProcessDetail } from '@/utils/processes';
import { requireGrant } from '@/utils/grants';

export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'processes:read');
  if (guard) return guard;

  const pid = Number(req.nextUrl.searchParams.get('pid'));
  if (!Number.isInteger(pid) || pid <= 0) {
    return NextResponse.json({ error: 'invalid pid' }, { status: 400 });
  }
  return NextResponse.json(await getProcessDetail(pid));
}
