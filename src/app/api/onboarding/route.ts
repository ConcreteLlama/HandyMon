import { NextRequest, NextResponse } from 'next/server';
import { getDismissed } from '@/utils/onboarding';
import { localhostOnly } from '@/utils/request-utils';

// Host-only, like the feature itself (see OnboardingOverlay) — config/setup
// happens on the host, so a paired remote device has no reason to call this.
export async function GET(req: NextRequest) {
  const guard = localhostOnly(req);
  if (guard) return guard;
  return NextResponse.json({ dismissed: getDismissed() });
}
