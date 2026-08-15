import { NextRequest, NextResponse } from 'next/server';
import qrcode from 'qrcode';
import os from 'os';
import dgram from 'dgram';
import { z } from 'zod';
import { createDevice } from '@/utils/devices';

// Picks whichever address in a first-match scan of os.networkInterfaces() —
// which on a dev/gaming machine is frequently a virtual adapter (Hyper-V/WSL2
// vEthernet, Docker, a VPN client) enumerated ahead of the real LAN NIC, since
// nothing about interface order reflects which one actually routes to the LAN.
function firstNonInternalIPv4(): string {
  const interfaces = os.networkInterfaces();
  for (const ifaces of Object.values(interfaces)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

// Asks the OS which local address it would actually route outbound traffic
// from, by opening a UDP "connection" (no packets sent — UDP connect() just
// binds the socket to the interface the routing table picks) to a public IP.
// This is the address a device elsewhere on the LAN needs to reach the host
// at, regardless of how many other (virtual/VPN/container) adapters exist.
function getLanIp(): Promise<string> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const fallback = () => {
      socket.close();
      resolve(firstNonInternalIPv4());
    };
    socket.once('error', fallback);
    try {
      socket.connect(80, '8.8.8.8', () => {
        const address = socket.address().address;
        socket.close();
        resolve(address && address !== '0.0.0.0' ? address : firstNonInternalIPv4());
      });
    } catch {
      fallback();
    }
  });
}

const PairBody = z.object({
  name: z.string().max(64).optional(),
  grants: z.array(z.string()).optional(), // omitted = full access
});

// POST — register a new device and return its QR code
export async function POST(req: NextRequest) {
  let body: unknown = {};
  try { body = await req.json(); } catch { /* no body = defaults (full access, no name) */ }
  const parsed = PairBody.safeParse(body);
  const { name, grants } = parsed.success ? parsed.data : {};

  const { token, registration } = createDevice(name, grants);

  const lanIp = await getLanIp();
  const hostHeader = req.headers.get('host') ?? '';
  const port = hostHeader.split(':')[1] ?? '44558';
  const pairUrl = `http://${lanIp}:${port}/pair-complete?token=${encodeURIComponent(token)}`;
  const qrDataUrl = await qrcode.toDataURL(pairUrl, { width: 260, margin: 2 });

  return NextResponse.json({ qrDataUrl, pairUrl, lanIp, deviceId: registration.id });
}
