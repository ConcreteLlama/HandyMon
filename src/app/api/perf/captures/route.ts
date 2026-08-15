import { NextRequest, NextResponse } from 'next/server';
import { listCaptures, readCaptureData, deleteCapture } from '@/utils/captures';
import { requireGrant } from '@/utils/grants';

// GET               → list historical captures (newest first)
// GET  ?file=<name> → parsed series + summary for one capture (the view dialog)
// DELETE ?file=<name>
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'perf:read');
  if (guard) return guard;

  const file = req.nextUrl.searchParams.get('file');
  if (file) {
    const data = readCaptureData(file);
    if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ captures: listCaptures() });
}

export async function DELETE(req: NextRequest) {
  const guard = requireGrant(req, 'perf:capture');
  if (guard) return guard;

  const file = req.nextUrl.searchParams.get('file') ?? '';
  return NextResponse.json({ ok: deleteCapture(file) });
}
