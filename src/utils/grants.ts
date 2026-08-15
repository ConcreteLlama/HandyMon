import { NextResponse } from 'next/server';
import { getDeviceById } from '@/utils/devices';
import type { Grant } from '@/types/grants';

// Broader than isLocalhostRequest's NextRequest param — some route handlers
// (e.g. the shared service-controller factory) are typed with plain Request.
// SECURITY: see the matching comment on isLocalhost() in src/middleware.ts —
// this Host-header check is only safe because server-guard.js's
// guardRequest() rejects spoofed Host: localhost requests before they ever
// reach here.
function isLocalhost(req: Request): boolean {
  const host = req.headers.get('host') ?? '';
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

// undefined grants = full access (back-compat for devices paired before this
// feature existed, and the natural default for newly-paired "Full Access" devices).
export function hasGrant(deviceId: string | null, grant: Grant): boolean {
  if (!deviceId) return false;
  const device = getDeviceById(deviceId);
  if (!device) return false;
  if (!device.grants) return true;
  return device.grants.includes(grant);
}

// The host device (localhost) always has full access, same as every other
// tiered-trust check in this app (isLocalhostRequest/localhostOnly). Grants
// only ever restrict remote/paired devices.
export function requireGrant(req: Request, grant: Grant): NextResponse | null {
  if (isLocalhost(req)) return null;
  const deviceId = req.headers.get('x-device-id');
  if (!hasGrant(deviceId, grant)) {
    return NextResponse.json({ error: `Missing permission: ${grant}` }, { status: 403 });
  }
  return null;
}
