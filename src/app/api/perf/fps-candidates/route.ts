import { NextRequest, NextResponse } from 'next/server';
import { listPresentMonCandidates } from '@/utils/presentmon';
import { requireGrant } from '@/utils/grants';

// Ranked snapshot of every process currently presenting frames — the process
// picker's candidate list. The client fetches this once when the picker
// opens (not polled) so the list stays stable while the user is choosing.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'perf:read');
  if (guard) return guard;
  return NextResponse.json(listPresentMonCandidates());
}
