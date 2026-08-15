import { NextRequest, NextResponse } from 'next/server';
import { checkLhmAvailable } from '@/utils/lhm';
import { requireGrant } from '@/utils/grants';

export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'perf:read');
  if (guard) return guard;
  return NextResponse.json(await checkLhmAvailable());
}
