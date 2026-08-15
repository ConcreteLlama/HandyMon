// Shared request guard for HandyMon's custom server entry points
// (tray-main.js and server.js).
//
// src/middleware.ts, src/utils/request-utils.ts, and src/utils/grants.ts all
// decide "is this the trusted host device" by checking the client-supplied
// Host header against localhost/127.0.0.1. That header is not authenticated
// by anything — any non-browser HTTP client (curl, a script) can set
// `Host: localhost` while connecting to the real LAN IP and address, and
// those checks would wrongly treat it as the host device, bypassing both
// login and the entire per-device grant system.
//
// This guard runs in the raw Node request handler, before Next.js sees
// anything, using the actual TCP socket's remote address (which a remote
// client cannot spoof) to catch exactly that mismatch: a request claiming
// Host: localhost whose connection didn't really come from loopback gets
// rejected here. Anything that reaches the app past this guard can be
// trusted to have an honest Host header again, which is what makes the
// downstream isLocalhost() checks safe to keep as-is.

const LOCALHOST_HOST_RE = /^(localhost|127\.0\.0\.1)(:\d+)?$/;
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function claimsLocalhost(req) {
  return LOCALHOST_HOST_RE.test(req.headers.host || '');
}

function isRealLoopback(req) {
  const remote = req.socket && req.socket.remoteAddress;
  return !!remote && LOOPBACK_ADDRESSES.has(remote);
}

// Returns true if the request was rejected (caller must not proceed to the
// Next.js handler). Returns false if the request should proceed normally.
function guardRequest(req, res) {
  if (claimsLocalhost(req) && !isRealLoopback(req)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Forbidden: Host header does not match connection origin' }));
    return true;
  }
  return false;
}

module.exports = { guardRequest, claimsLocalhost, isRealLoopback };
