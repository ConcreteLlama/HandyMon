import { NextRequest } from 'next/server';

// SECURITY: see the matching comment on isLocalhost() in src/middleware.ts —
// this Host-header check is only safe because server-guard.js's
// guardRequest() rejects spoofed Host: localhost requests before they ever
// reach here.
export function isLocalhostRequest(req: NextRequest): boolean {
  const host = req.headers.get('host') ?? '';
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

export function localhostOnly(req: NextRequest) {
  if (!isLocalhostRequest(req)) {
    return Response.json(
      { error: 'This action requires access from the host device' },
      { status: 403 }
    );
  }
  return null;
}
