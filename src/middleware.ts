import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDeviceById } from '@/utils/devices';
import { verifySignedRequest } from '@/utils/request-signing';
import { log } from '@/utils/logger';

const COOKIE_NAME = 'pc-control-auth';

// Always open — no auth, no origin check. /pair-complete and its API call
// are reachable pre-auth by design (that's the point — a device isn't
// paired yet when it lands here), but each still requires a valid one-time
// pairing token to do anything (see /api/auth/complete-pairing).
const OPEN_PATHS = ['/login', '/pair-complete', '/api/auth/complete-pairing'];

// Open (no auth) but reachable only from the hosting device
const LOCALHOST_PATHS = ['/pair', '/api/auth/pair-info'];

// SECURITY: this trusts the client-supplied Host header, which is normally
// spoofable by any non-browser HTTP client. That's only safe here because
// server-guard.js's guardRequest() (used by both tray-main.js and
// server.js) rejects any request claiming Host: localhost/127.0.0.1 whose
// real TCP connection isn't actually loopback, before Next.js ever sees the
// request. If you add a new way to run this app, route it through that same
// guard — otherwise this check becomes spoofable again.
function isLocalhost(req: NextRequest): boolean {
  const host = req.headers.get('host') ?? '';
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

// Validates the HMAC-signed device session token — used for the page-shell
// cookie only. API calls use per-request signing instead (see below and
// request-signing.ts) since a static token, sent on every request forever,
// is exactly the thing that made a single sniffed request a standing
// credential. Page navigation can't carry custom signing headers, so this
// token still gates whether the SPA shell loads at all.
// Token format: <deviceId>.<HMAC-SHA256(deviceId, secret), base64url, 24 chars>
function isValidToken(token: string, secret: string): boolean {
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const computed = crypto.createHmac('sha256', secret).update(id).digest('base64url').slice(0, 24);
  return computed === sig;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (OPEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  if (isLocalhost(req)) {
    return NextResponse.next();
  }

  if (LOCALHOST_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // API calls: per-request signature required, not the session cookie/bearer
  // token — see request-signing.ts and request-signing-client.ts.
  if (pathname.startsWith('/api/')) {
    const deviceId = req.headers.get('x-device-id');
    const timestamp = req.headers.get('x-signature-timestamp');
    const nonce = req.headers.get('x-signature-nonce');
    const signature = req.headers.get('x-signature');
    const device = deviceId ? getDeviceById(deviceId) : null;

    if (!deviceId || !timestamp || !nonce || !signature || !device?.publicKeyJwk) {
      log.warn('Signed API request rejected — missing headers or unpaired-for-signing device', {
        path: pathname, deviceId, hasTimestamp: !!timestamp, hasNonce: !!nonce, hasSignature: !!signature,
        deviceFound: !!device, hasPublicKey: !!device?.publicKeyJwk,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = verifySignedRequest({ deviceId, timestamp, nonce, signature }, req.method, pathname + search, device.publicKeyJwk);
    if (!result.ok) {
      log.warn('Signed API request rejected', { path: pathname, deviceId, reason: result.reason });
      // reason is included in the response (not just logged) so the client
      // can tell "clock out of sync" (expired — recoverable by the user,
      // nothing wrong with the pairing) apart from a genuinely bad signature
      // (malformed/invalid/replay — re-pairing is the right advice for
      // those). Without this every rejection looked identical from the
      // client's side, so a stale timestamp read as "not paired" — the
      // wrong diagnosis pointing at the wrong fix.
      return NextResponse.json({ error: 'Unauthorized', reason: result.reason }, { status: 401 });
    }

    const headers = new Headers(req.headers);
    headers.set('x-device-id', deviceId);
    return NextResponse.next({ request: { headers } });
  }

  // Page/document routes: still cookie/bearer-gated — a plain browser
  // navigation can't attach custom signing headers, so this only decides
  // whether the SPA shell (and its JS bundle) loads, not any control action.
  const secret = process.env.PC_CONTROL_SERVER_SECRET;
  if (!secret) {
    // Server secret not initialised yet — shouldn't happen in production
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const bearer = req.headers.get('authorization')?.slice(7);
  const provided = cookie || bearer;

  if (provided && isValidToken(provided, secret)) {
    const dot = provided.lastIndexOf('.');
    const deviceId = dot >= 0 ? provided.slice(0, dot) : '';
    const headers = new Headers(req.headers);
    headers.set('x-device-id', deviceId);
    return NextResponse.next({ request: { headers } });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs',
};
