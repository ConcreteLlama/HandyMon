import { NextRequest, NextResponse } from 'next/server';
import { getActiveDisplayProfileId } from '@/utils/display-profiles';
import { requireGrant } from '@/utils/grants';
import { log } from '@/utils/logger';

// Best-effort match of the live monitor layout against saved profiles, by
// fingerprint (see native-display.ts's Fingerprint()). Not a "which profile
// did you last apply" record — a fresh comparison every call, so it reflects
// reality even after someone changes displays outside this app.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'displayoutput:read');
  if (guard) return guard;

  try {
    const activeId = await getActiveDisplayProfileId();
    return NextResponse.json({ activeId });
  } catch (e: any) {
    log.error('display/profiles/active threw', { error: e.message });
    return NextResponse.json({ activeId: null });
  }
}
