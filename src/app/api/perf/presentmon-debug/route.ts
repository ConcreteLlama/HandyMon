import { NextRequest, NextResponse } from 'next/server';
import { diagnosticProbePresentMon } from '@/utils/presentmon';
import { requireGrant } from '@/utils/grants';

// Deterministic PresentMon diagnostic — spawns a fresh one-shot probe with the
// real streaming args and reports exactly what happened (header parsed / exit
// code / timeout), rather than a snapshot of the persistent capture's
// possibly-stale internal state.
// Every query param here exists purely for one-off investigation (currently:
// PresentMon 2.5.1 compatibility) — see diagnosticProbe()'s own comment for
// what each is checking. None of it is used by the app's normal operation.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'settings:write');
  if (guard) return guard;
  const q = req.nextUrl.searchParams;
  const seconds = Number(q.get('seconds'));
  const circularBufferSize = Number(q.get('circularBufferSize'));
  return NextResponse.json(await diagnosticProbePresentMon({
    seconds: isFinite(seconds) && seconds > 0 ? seconds : undefined,
    processName: q.get('process') ?? undefined,
    metricsVersion: q.get('metricsVersion') === 'v2' ? 'v2' : 'v1',
    circularBufferSize: isFinite(circularBufferSize) && circularBufferSize > 0 ? circularBufferSize : undefined,
    outputMode: q.get('outputMode') === 'file' ? 'file' : 'stdout',
    noTrackGpu: q.get('noTrackGpu') === '1',
    noTrackDisplay: q.get('noTrackDisplay') === '1',
    noTrackInput: q.get('noTrackInput') === '1',
  }));
}
