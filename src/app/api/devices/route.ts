import { NextRequest, NextResponse } from 'next/server';
import { getDevices } from '@/utils/devices';
import { localhostOnly } from '@/utils/request-utils';

export async function GET(req: NextRequest) {
  const guard = localhostOnly(req);
  if (guard) return guard;

  // Strip tokens from the response — clients never need them
  const devices = getDevices().map(({ id, name, pairedAt, lastSeen, grants }) => ({ id, name, pairedAt, lastSeen, grants }));
  return NextResponse.json({ devices });
}
