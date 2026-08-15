import { NextRequest, NextResponse } from 'next/server';
import { probeLhm } from '@/utils/lhm';
import { requireGrant } from '@/utils/grants';

// Server-side probe of the LHM web server on a given port. Runs on the host PC,
// so a remote browser client doesn't need to reach the LHM port directly.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'settings:write');
  if (guard) return guard;

  const port = Number(req.nextUrl.searchParams.get('port'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return NextResponse.json({ ok: false, detail: 'invalid port' }, { status: 400 });
  }
  return NextResponse.json(await probeLhm(port));
}
