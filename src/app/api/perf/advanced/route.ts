import { NextRequest, NextResponse } from 'next/server';
import { collectAdvancedStats } from '@/utils/perf';
import { requireGrant } from '@/utils/grants';

export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'perf:read');
  if (guard) return guard;

  try {
    return NextResponse.json(await collectAdvancedStats());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
