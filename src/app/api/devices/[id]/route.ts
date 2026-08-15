import { NextRequest, NextResponse } from 'next/server';
import { deleteDevice, updateDevice } from '@/utils/devices';
import { localhostOnly } from '@/utils/request-utils';
import { IdSegmentParams } from '@/types/segment-params';
import { z } from 'zod';

export async function DELETE(req: NextRequest, segmentParams: IdSegmentParams) {
  const guard = localhostOnly(req);
  if (guard) return guard;

  const { id } = await segmentParams.params;
  const ok = deleteDevice(id);
  return ok
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Device not found' }, { status: 404 });
}

export async function PATCH(req: NextRequest, segmentParams: IdSegmentParams) {
  const guard = localhostOnly(req);
  if (guard) return guard;

  const { id } = await segmentParams.params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = z.object({
    name: z.string().min(1).max(64).optional(),
    grants: z.array(z.string()).optional().nullable(), // null = explicitly clear to full access
  }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid update' }, { status: 400 });

  const { name, grants } = parsed.data;
  const ok = updateDevice(id, {
    ...(name !== undefined ? { name } : {}),
    ...(grants !== undefined ? { grants: grants ?? undefined } : {}),
  });
  return ok
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Device not found' }, { status: 404 });
}
