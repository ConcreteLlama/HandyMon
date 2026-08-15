import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { IdSegmentParams } from '@/types/segment-params';
import { deleteDisplayProfile, renameDisplayProfile, updateDisplayProfile } from '@/utils/display-profiles';
import { requireGrant } from '@/utils/grants';
import { log } from '@/utils/logger';

const PutBody = z.object({ excludeTargetIds: z.array(z.number()).optional() });
const PatchBody = z.object({ label: z.string().min(1) });

export async function DELETE(req: NextRequest, segmentParams: IdSegmentParams) {
  const guard = requireGrant(req, 'displayoutput:write');
  if (guard) return guard;

  const { id } = await segmentParams.params;
  deleteDisplayProfile(id);
  return NextResponse.json({ ok: true });
}

// "Update with current setup" — re-captures the live layout into this
// existing profile (same id/label/position), rather than creating a new one.
export async function PUT(req: NextRequest, segmentParams: IdSegmentParams) {
  const guard = requireGrant(req, 'displayoutput:write');
  if (guard) return guard;

  const { id } = await segmentParams.params;
  let excludeTargetIds: number[] = [];
  try {
    const body = await req.json();
    const parsed = PutBody.safeParse(body);
    if (parsed.success) excludeTargetIds = parsed.data.excludeTargetIds ?? [];
  } catch {
    // No/empty body is fine — defaults to excluding nothing.
  }

  try {
    const updated = await updateDisplayProfile(id, excludeTargetIds);
    if (!updated) return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
    return NextResponse.json({ ok: true, profile: { id: updated.id, label: updated.label } });
  } catch (e: any) {
    log.error('display/profiles/[id] PUT threw', { id, error: e.message });
    return NextResponse.json({ ok: false, error: e.message ?? 'Update failed' }, { status: 500 });
  }
}

// Rename — label only, id/json/fingerprint untouched.
export async function PATCH(req: NextRequest, segmentParams: IdSegmentParams) {
  const guard = requireGrant(req, 'displayoutput:write');
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });

  const { id } = await segmentParams.params;
  const updated = renameDisplayProfile(id, parsed.data.label.trim());
  if (!updated) return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
  return NextResponse.json({ ok: true, profile: { id: updated.id, label: updated.label } });
}
