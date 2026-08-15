import { NextRequest, NextResponse } from 'next/server';
import { isLocalhostRequest } from '@/utils/request-utils';
import { getDeviceById } from '@/utils/devices';
import { ALL_GRANTS } from '@/types/grants';

// "Who am I / what can I do" — for the client's own "My Connection" view.
// Not the security boundary (every route still re-checks via requireGrant);
// this is purely so a user can see their own name/permissions/connection info.
export async function GET(req: NextRequest) {
  const localhost = isLocalhostRequest(req);
  const userAgent = req.headers.get('user-agent') ?? 'unknown';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  if (localhost) {
    return NextResponse.json({
      name: 'This PC (host)',
      grants: ALL_GRANTS,
      isLocalhost: true,
      userAgent,
      ip,
      pairedAt: null,
      lastSeen: null,
    });
  }

  const deviceId = req.headers.get('x-device-id');
  const device = deviceId ? getDeviceById(deviceId) : null;
  if (!device) {
    return NextResponse.json({ error: 'Not recognized' }, { status: 401 });
  }

  return NextResponse.json({
    name: device.name,
    grants: device.grants ?? ALL_GRANTS,
    isLocalhost: false,
    userAgent,
    ip,
    pairedAt: device.pairedAt,
    lastSeen: device.lastSeen,
  });
}
