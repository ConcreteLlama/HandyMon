import { NextRequest, NextResponse } from 'next/server';
import { isLocalhostRequest } from '@/utils/request-utils';
import { getDeviceById } from '@/utils/devices';
import { ALL_GRANTS } from '@/types/grants';

// Lets the calling device ask "what am I allowed to do" — used for
// client-side UI gating (hide/disable). Not the security boundary itself;
// every route re-checks via requireGrant() regardless of what this reports.
export async function GET(req: NextRequest) {
  if (isLocalhostRequest(req)) {
    return NextResponse.json({ grants: ALL_GRANTS });
  }
  const deviceId = req.headers.get('x-device-id');
  const device = deviceId ? getDeviceById(deviceId) : null;
  if (!device) return NextResponse.json({ grants: [] });
  return NextResponse.json({ grants: device.grants ?? ALL_GRANTS });
}
