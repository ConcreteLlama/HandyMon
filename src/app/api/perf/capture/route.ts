import { NextRequest, NextResponse } from 'next/server';
import { startCaptureRun, stopCaptureRun, clearCaptureRun, captureRunStatus } from '@/utils/presentmon';
import { requireGrant } from '@/utils/grants';

// GET  → current capture-run status.
// POST ?action=start|stop|clear → perform the action, return the new status.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'perf:read');
  if (guard) return guard;
  return NextResponse.json(captureRunStatus());
}

export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'perf:capture');
  if (guard) return guard;

  const action = req.nextUrl.searchParams.get('action');
  if (action === 'start') {
    const result = startCaptureRun();
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  } else if (action === 'stop') {
    stopCaptureRun();
  } else if (action === 'clear') {
    clearCaptureRun();
  } else {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }
  return NextResponse.json(captureRunStatus());
}
