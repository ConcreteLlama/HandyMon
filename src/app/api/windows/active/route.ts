import { NextRequest, NextResponse } from 'next/server';
import { queryNativeWorker } from '@/utils/native-worker';
import { requireGrant } from '@/utils/grants';

export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'processes:read');
  if (guard) return guard;

  try {
    const result = await queryNativeWorker<{ pid: number }>('foreground');
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
