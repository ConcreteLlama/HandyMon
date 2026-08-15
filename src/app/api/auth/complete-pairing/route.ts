import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidDeviceToken, activateDevice, setDevicePublicKey } from '@/utils/devices';

const COOKIE_NAME = 'pc-control-auth';
const YEAR = 60 * 60 * 24 * 365;

const Body = z.object({
  token: z.string(),
  publicKeyJwk: z.record(z.string(), z.any()),
});

// Completes pairing after the client (src/app/pair-complete/page.tsx) has
// generated its own keypair and kept the private half to itself — this only
// ever receives the public key, which isn't sensitive, so there's no
// bootstrap-secret-exposure problem the way an earlier HMAC-shared-secret
// version of this had.
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });

  const { token, publicKeyJwk } = parsed.data;
  if (!isValidDeviceToken(token)) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired pairing link' }, { status: 400 });
  }

  const device = activateDevice(token, req.headers.get('user-agent') ?? '');
  if (!device) {
    return NextResponse.json({ ok: false, error: 'Device not found' }, { status: 404 });
  }
  setDevicePublicKey(device.id, publicKeyJwk as JsonWebKey);

  const res = NextResponse.json({ ok: true, deviceId: device.id });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: YEAR,
  });
  return res;
}
