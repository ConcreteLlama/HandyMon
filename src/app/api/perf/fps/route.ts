import { NextRequest, NextResponse } from 'next/server';
import { ensurePresentMon, presentMonAvailable, getPresentMonFramerate, getPresentMonProcess, getPinnedPresentMonProcess } from '@/utils/presentmon';
import { requireGrant } from '@/utils/grants';

// Lightweight FPS-only endpoint — reads the in-memory PresentMon buffer (no LHM,
// no PowerShell), so the Frame page can poll it fast for near-realtime FPS while
// the heavier /api/perf/stats sensor poll stays at its slower cadence.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'perf:read');
  if (guard) return guard;
  ensurePresentMon();
  return NextResponse.json({
    timestamp: Date.now(),
    fpsAvailable: presentMonAvailable(),
    process: getPresentMonProcess(),
    pinnedProcess: getPinnedPresentMonProcess()?.displayName ?? null,
    gpu: getPresentMonFramerate(),
  });
}
