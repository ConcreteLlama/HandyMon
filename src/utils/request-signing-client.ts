import { p256 } from '@noble/curves/nist.js';

// Client half of request-signing.ts's ECDSA scheme — signs every API call
// with a keypair generated on-device at pairing time (see
// src/app/pair-complete/page.tsx), instead of sending a static, replayable
// token/secret.
//
// Uses @noble/curves (pure JS) rather than the browser's native
// crypto.subtle, deliberately: crypto.subtle is only available in a "secure
// context" (HTTPS, or the special-cased localhost) — a plain LAN IP over
// HTTP, which is exactly how every paired remote device reaches this app,
// does not qualify, so crypto.subtle is simply undefined there (confirmed
// live: "Cannot read properties of undefined (reading 'generateKey')" on a
// real phone). Since that restriction applies no matter which signing
// scheme sits on top of it, staying on HTTP means using a crypto
// implementation the platform doesn't gate — hence a JS library instead of
// the native API. The one thing this gives up versus the native version:
// the private key is now a plain byte array, not a browser-enforced
// non-extractable CryptoKey — a compromised page script could in principle
// read it out of storage. It still never crosses the network, which is the
// property that actually matters here.
const STORAGE_KEY = 'pc-control-signing-keypair';

interface StoredKeyRecord {
  deviceId: string;
  privateKeyHex: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Generates a fresh P-256 keypair, stores {deviceId, privateKeyHex} in
// localStorage, and returns the public key as a JWK (RFC 7518 EC public key
// shape) for the server to store. keygen()'s own publicKey is COMPRESSED
// (33 bytes, 0x02/0x03 prefix — confirmed empirically, not documented
// clearly) which isn't enough to build a JWK's separate x/y fields, so this
// re-derives the uncompressed SEC1 form (0x04 || X || Y, 65 bytes) via
// getPublicKey(secretKey, false) instead and builds the JWK from that.
export async function generateAndStoreKeyPair(deviceId: string): Promise<JsonWebKey> {
  const { secretKey } = p256.keygen();
  const publicKey = p256.getPublicKey(secretKey, false);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ deviceId, privateKeyHex: bytesToHex(secretKey) }));

  const x = publicKey.slice(1, 33);
  const y = publicKey.slice(33, 65);
  return { kty: 'EC', crv: 'P-256', x: toBase64Url(x), y: toBase64Url(y) };
}

let cachedRecord: StoredKeyRecord | null | undefined; // undefined = not checked yet, null = confirmed none

function getKeyRecord(): StoredKeyRecord | null {
  if (typeof window === 'undefined') return null;
  if (cachedRecord !== undefined) return cachedRecord;

  let result: StoredKeyRecord | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.deviceId === 'string' && typeof parsed.privateKeyHex === 'string') result = parsed;
  } catch {
    result = null;
  }
  cachedRecord = result;
  return result;
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

// Returns the signing headers for this request, or null when this device
// has no stored keypair — the host/localhost browser (which never needs
// one; isLocalhost() in middleware.ts bypasses signing entirely) or a
// device paired before request signing existed (needs to re-pair).
export async function signRequest(method: string, url: string): Promise<Record<string, string> | null> {
  const record = getKeyRecord();
  if (!record) return null;

  const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const timestamp = String(Date.now());
  const nonce = randomNonce();
  const message = `${method.toUpperCase()}\n${u.pathname}${u.search}\n${timestamp}\n${nonce}`;

  const sigBytes = p256.sign(new TextEncoder().encode(message), hexToBytes(record.privateKeyHex));
  const signature = toBase64Url(sigBytes);

  return {
    'X-Device-Id': record.deviceId,
    'X-Signature-Timestamp': timestamp,
    'X-Signature-Nonce': nonce,
    'X-Signature': signature,
  };
}
