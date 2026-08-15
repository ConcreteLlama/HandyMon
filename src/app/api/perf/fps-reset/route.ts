import { NextRequest, NextResponse } from 'next/server';
import { resetPresentMon } from '@/utils/presentmon';
import { requireGrant } from '@/utils/grants';

// Clears the PresentMon session buffers so avg / min / max / 1% lows restart.
export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'perf:capture');
  if (guard) return guard;
  resetPresentMon();
  return NextResponse.json({ ok: true });
}
