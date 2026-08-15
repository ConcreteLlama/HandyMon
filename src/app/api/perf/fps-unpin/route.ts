import { NextRequest, NextResponse } from 'next/server';
import { unpinPresentMonProcess } from '@/utils/presentmon';
import { requireGrant } from '@/utils/grants';

export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'perf:capture');
  if (guard) return guard;
  unpinPresentMonProcess();
  return NextResponse.json({ ok: true });
}
