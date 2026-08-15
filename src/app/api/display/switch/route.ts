import { DisplayProfile } from '@/types/display-profiles';
import { setDisplayProfile } from '@/utils/display-profiles';
import { NextRequest, NextResponse } from 'next/server';
import { requireGrant } from '@/utils/grants';
import { log } from '@/utils/logger';

export async function POST(request: NextRequest): Promise<Response> {
  const guard = requireGrant(request, 'displayoutput:write');
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const profile = searchParams.get('profile');
  if (!profile) {
    return NextResponse.json({
      message: 'Must specify a display profile name'
    })
  }
  const allowChanges = searchParams.get('allowChanges') === 'true';
  try {
    // A failed apply is a normal, structured outcome (ok: false + message +
    // canRetryWithChanges), not a server error — status 200 either way, so
    // apiFetch (which throws on any non-2xx and only reads an `.error`
    // field) passes the body through instead of discarding it for a generic
    // "Request failed (500)".
    const result = await setDisplayProfile(profile as DisplayProfile, allowChanges);
    return NextResponse.json(result);
  } catch (e: any) {
    log.error('display/switch threw', { profile, allowChanges, error: e.message });
    return NextResponse.json({ ok: false, message: e.message ?? 'Switch failed unexpectedly — see server log' }, { status: 500 });
  }
}
