import { NextRequest, NextResponse } from 'next/server';
import { startComparison, pauseComparison, continueComparison, finishComparison, comparisonStatus } from '@/utils/comparisons';
import { requireGrant } from '@/utils/grants';

// GET  → current comparison status (mirrors /api/perf/capture's live-status shape).
// POST ?action=start|pause|continue|finish, body { label? } → perform the action, return the new status.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'perf:read');
  if (guard) return guard;
  return NextResponse.json(comparisonStatus());
}

export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'perf:capture');
  if (guard) return guard;

  const action = req.nextUrl.searchParams.get('action');
  const body = await req.json().catch(() => ({}));
  const label: string | undefined = typeof body?.label === 'string' ? body.label : undefined;

  if (action === 'start') {
    const result = startComparison(label, body?.variantLabel);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  } else if (action === 'pause') {
    const result = pauseComparison();
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  } else if (action === 'continue') {
    const matchFirstDuration = body?.matchFirstDuration === true;
    const result = continueComparison(label, matchFirstDuration);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  } else if (action === 'finish') {
    const result = await finishComparison();
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    // `comparisonStatus()` is {active:false} by the time finish resolves —
    // include the just-finished id separately so the client can open its
    // viewer directly instead of needing a second round trip to find it.
    return NextResponse.json({ ...comparisonStatus(), finishedId: result.id });
  } else {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }
  return NextResponse.json(comparisonStatus());
}
