import crypto from 'crypto';

// Per-request ECDSA signing for the API surface — replaces sending a single
// static, endlessly-replayable session token on every call (the previous
// model: sniff any one request, replay it forever). Each paired device
// generates its own keypair on-device (see request-signing-client.ts); only
// the public half (DeviceRegistration.publicKeyJwk, see devices.ts) is ever
// sent to the server, at pairing time — there's nothing secret to sniff,
// unlike an earlier HMAC-shared-secret version of this that had to bootstrap
// a secret both sides held.
//
// Deliberately NOT included in the signed message: the request body. Next.js
// middleware can't rewrite a request's body (only headers) when forwarding
// to the route handler, so there's no way to both read the body here to sign
// it AND let the route handler read it again afterwards. This means a
// captured request's body could be swapped by an *active* on-path attacker
// before the original reaches the server (the nonce is single-use, so this
// only works ahead of the real request, not as a standing replay) — a
// materially harder attack than the passive sniffing this is built to stop,
// and out of scope for what a plain HTTP LAN app can reasonably defend
// against anyway.
const WINDOW_MS = 5 * 60 * 1000;

// deviceId:nonce -> expiry epoch ms. Only middleware ever calls
// verifySignedRequest (route handlers don't), so unlike devices.ts's cache
// there's no cross-bundle-instance sharing concern here — a single consumer
// owns this map.
const usedNonces = new Map<string, number>();

function pruneNonces(now: number): void {
  for (const [key, expiry] of usedNonces) {
    if (expiry < now) usedNonces.delete(key);
  }
}

export interface SignedRequestHeaders {
  deviceId: string;
  timestamp: string;
  nonce: string;
  signature: string;
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'expired' | 'replay' | 'malformed' | 'invalid' };

export function verifySignedRequest(
  headers: SignedRequestHeaders,
  method: string,
  pathWithQuery: string,
  publicKeyJwk: JsonWebKey,
): VerifyResult {
  const now = Date.now();
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > WINDOW_MS) {
    return { ok: false, reason: 'expired' };
  }

  pruneNonces(now);
  const nonceKey = `${headers.deviceId}:${headers.nonce}`;
  if (usedNonces.has(nonceKey)) {
    return { ok: false, reason: 'replay' };
  }

  const message = `${method.toUpperCase()}\n${pathWithQuery}\n${headers.timestamp}\n${headers.nonce}`;

  let signature: Buffer;
  let publicKey: crypto.KeyObject;
  try {
    signature = Buffer.from(headers.signature, 'base64url');
    publicKey = crypto.createPublicKey({ key: publicKeyJwk as crypto.JsonWebKeyInput['key'], format: 'jwk' });
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  // dsaEncoding must be 'ieee-p1363' — that's the raw r||s format
  // crypto.subtle.sign() produces in the browser. Node's classic crypto API
  // defaults to DER-encoded ASN.1 signatures instead, which would make every
  // valid signature fail verification silently (same value, wrong encoding).
  let valid: boolean;
  try {
    valid = crypto.verify('sha256', Buffer.from(message, 'utf-8'), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!valid) {
    return { ok: false, reason: 'invalid' };
  }

  usedNonces.set(nonceKey, now + WINDOW_MS);
  return { ok: true };
}
