import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CONFIG_DIR } from './dirs';

const DEVICES_FILE = path.join(CONFIG_DIR, 'devices.json');
const SERVER_SECRET_FILE = path.join(CONFIG_DIR, 'server-secret');
const SERVER_SECRET_KEY = 'PC_CONTROL_SERVER_SECRET';

// A UTF-8 BOM (e.g. from PowerShell's `-Encoding UTF8`, or Notepad's default
// UTF-8 save) makes JSON.parse throw "Unexpected token" on the very first
// character — silently caught below, which used to be indistinguishable from
// "file doesn't exist yet" and led straight to generating a brand new secret
// (invalidating every paired device) or wiping the rest of config.json.
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

export interface DeviceRegistration {
  id: string;
  name: string;
  pairedAt: string;
  lastSeen: string | null;
  grants?: string[]; // undefined = full access (back-compat for devices paired before grants existed)
  // Public half of a per-device ECDSA P-256 keypair, used to verify signed
  // API requests (see src/utils/request-signing.ts). The private key is
  // generated on-device (via request-signing-client.ts) and never leaves
  // it — only this public key ever crosses the network, at pairing time,
  // which is why there's no bootstrap-secret-exposure problem the way a
  // shared-secret scheme would have. Undefined for devices paired before
  // request signing existed; those need to re-pair.
  publicKeyJwk?: JsonWebKey;
}

const PLACEHOLDER_NAME = 'Pending device';

// ── Server secret ─────────────────────────────────────────────────────────────

// Its own file, separate from config.json (AppConfig) — this used to live
// inside config.json, sharing a file (and every write to it) with unrelated
// user settings. Any hiccup reading/writing that shared file (e.g. a stray
// BOM, a partial write) could silently regenerate the secret — invalidating
// every already-paired device's token — or wipe the user's actual config
// alongside it. A dedicated file means the two can never corrupt each other.
function loadOrCreateServerSecret(): string {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  try {
    const existing = stripBom(fs.readFileSync(SERVER_SECRET_FILE, 'utf-8')).trim();
    if (existing.length >= 32) return existing;
  } catch {}

  // Migrate a secret that predates this file (used to live in config.json)
  // instead of generating a fresh one, so existing paired devices don't all
  // get silently invalidated by this change.
  let migrated: string | undefined;
  try {
    const raw = JSON.parse(stripBom(fs.readFileSync(path.join(CONFIG_DIR, 'config.json'), 'utf-8')));
    if (typeof raw.serverSecret === 'string' && raw.serverSecret.length >= 32) migrated = raw.serverSecret;
  } catch {}

  const secret = migrated ?? crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SERVER_SECRET_FILE, secret);
  return secret;
}

export function initDevices(): void {
  const secret = loadOrCreateServerSecret();
  process.env[SERVER_SECRET_KEY] = secret;

  const devices = readDevices();
  console.log(`[HandyMon] ${devices.length} paired device(s)`);
}

// ── Token generation and validation ──────────────────────────────────────────

// Token format: <deviceId>.<HMAC-SHA256(deviceId, serverSecret), base64url, 24 chars>
// Middleware validates the HMAC using only the server secret — no list needed.

function hmacSync(id: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(id).digest('base64url').slice(0, 24);
}

export function generateDeviceToken(deviceId: string): string {
  const secret = process.env[SERVER_SECRET_KEY] ?? '';
  return `${deviceId}.${hmacSync(deviceId, secret)}`;
}

export function isValidDeviceToken(token: string): boolean {
  const secret = process.env[SERVER_SECRET_KEY];
  if (!secret) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  return sig === hmacSync(id, secret) && readDevices().some(d => d.id === id);
}

// ── Device registry ───────────────────────────────────────────────────────────

// getDeviceById() (via readDevices()) now runs on every signed API request,
// not just device-management calls — a sync disk read + JSON.parse per
// request is wasteful when e.g. FPS polling can hit this every ~100-400ms.
//
// NOT a same-process-so-a-plain-cache-is-safe situation, though: Next.js
// compiles middleware as a separate bundle from route handlers, each with
// its OWN module instance of this file — a plain "cache until write()"
// approach left middleware stuck with whatever it first read forever, since
// middleware only ever calls getDeviceById() (reads), never writeDevices();
// every actual pairing/deletion happens via a route handler's own, entirely
// separate cache instance, invisible to middleware's copy (confirmed live:
// worked once after a restart, then every device created afterward was
// invisible to middleware — deviceFound: false — until restarted again).
// mtime-based invalidation fixes this correctly regardless of which module
// instance is asking, since it's keyed off the file's actual state rather
// than an in-process write happening to be visible.
let devicesCache: DeviceRegistration[] | null = null;
let cachedMtimeMs = -1;

function readDevices(): DeviceRegistration[] {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(DEVICES_FILE).mtimeMs;
  } catch {
    devicesCache = [];
    cachedMtimeMs = -1;
    return devicesCache;
  }

  if (devicesCache && mtimeMs === cachedMtimeMs) return devicesCache;

  try {
    devicesCache = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf-8'));
    cachedMtimeMs = mtimeMs;
  } catch {
    devicesCache = [];
    cachedMtimeMs = -1;
  }
  return devicesCache!;
}

function writeDevices(devices: DeviceRegistration[]): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = DEVICES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(devices, null, 2));
  fs.renameSync(tmp, DEVICES_FILE);
  devicesCache = devices;
  try {
    cachedMtimeMs = fs.statSync(DEVICES_FILE).mtimeMs;
  } catch {
    cachedMtimeMs = -1;
  }
}

export function getDevices(): DeviceRegistration[] {
  return readDevices();
}

export function createDevice(name?: string, grants?: string[]): { registration: DeviceRegistration; token: string } {
  const id = crypto.randomBytes(8).toString('hex');
  const registration: DeviceRegistration = {
    id,
    name: name?.trim() || PLACEHOLDER_NAME,
    pairedAt: new Date().toISOString(),
    lastSeen: null,
    ...(grants ? { grants } : {}),
  };
  writeDevices([...readDevices(), registration]);
  return { registration, token: generateDeviceToken(id) };
}

// Called once, when the paired device completes pairing (see
// /api/auth/complete-pairing) after generating its own keypair client-side
// and sending back only the public half.
export function setDevicePublicKey(id: string, publicKeyJwk: JsonWebKey): DeviceRegistration | null {
  const devices = readDevices();
  const device = devices.find(d => d.id === id);
  if (!device) return null;
  const updated = { ...device, publicKeyJwk };
  writeDevices(devices.map(d => d.id === id ? updated : d));
  return updated;
}

export function activateDevice(token: string, userAgent?: string): DeviceRegistration | null {
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const id = token.slice(0, dot);

  const devices = readDevices();
  const device = devices.find(d => d.id === id);
  if (!device) return null;

  // Only auto-name from the User-Agent if the admin didn't already set a name
  // at pairing time — otherwise an explicit "Kid's Phone" would get clobbered
  // by "Android device" the moment it first connects.
  const name = device.name !== PLACEHOLDER_NAME ? device.name : nameFromUserAgent(userAgent ?? '');
  const updated = { ...device, name, lastSeen: new Date().toISOString() };
  writeDevices(devices.map(d => d.id === id ? updated : d));
  return updated;
}

export function getDeviceById(id: string): DeviceRegistration | null {
  return readDevices().find(d => d.id === id) ?? null;
}

export function updateDevice(id: string, updates: { name?: string; grants?: string[] }): boolean {
  const devices = readDevices();
  if (!devices.find(d => d.id === id)) return false;
  writeDevices(devices.map(d => d.id === id ? { ...d, ...updates } : d));
  return true;
}

export function deleteDevice(id: string): boolean {
  const devices = readDevices();
  const next = devices.filter(d => d.id !== id);
  if (next.length === devices.length) return false;
  writeDevices(next);
  return true;
}

function nameFromUserAgent(ua: string): string {
  if (/iPhone/i.test(ua))  return 'iPhone';
  if (/iPad/i.test(ua))    return 'iPad';
  if (/Android/i.test(ua)) return 'Android device';
  if (/Windows/i.test(ua)) return 'Windows device';
  if (/Mac/i.test(ua))     return 'Mac';
  return 'Paired device';
}
