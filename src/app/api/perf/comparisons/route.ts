import { NextRequest, NextResponse } from 'next/server';
import { listComparisons, readComparison, deleteComparison, setVariantRegion, createComparisonFromCaptures } from '@/utils/comparisons';
import { requireGrant } from '@/utils/grants';

// GET             → list historical comparisons (newest first)
// GET  ?id=<name> → full manifest + each variant's parsed data (the comparison viewer)
// POST ?id=<name>&action=set-region, body { variantBase, start, end } → region selector (Phase 2)
// POST ?action=create-from-captures, body { label?, captures: [{ file, label? }] } → build a
//   Comparison from existing standalone captures instead of recording variants live
// DELETE ?id=<name>
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'perf:read');
  if (guard) return guard;

  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    const data = readComparison(id);
    if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ comparisons: listComparisons() });
}

export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'perf:capture');
  if (guard) return guard;

  const action = req.nextUrl.searchParams.get('action');
  const body = await req.json().catch(() => ({}));

  if (action === 'create-from-captures') {
    const label = typeof body?.label === 'string' ? body.label : undefined;
    const rawCaptures = Array.isArray(body?.captures) ? body.captures : [];
    const items = rawCaptures
      .filter((it: unknown): it is { file: unknown; label: unknown } => !!it && typeof it === 'object')
      .filter((it: { file: unknown }) => typeof it.file === 'string')
      .map((it: { file: unknown; label: unknown }) => ({ file: it.file as string, label: typeof it.label === 'string' ? it.label : undefined }));
    const result = createComparisonFromCaptures(items, label);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ ok: true, id: result.id });
  }

  if (action === 'set-region') {
    const id = req.nextUrl.searchParams.get('id') ?? '';
    const variantBase = typeof body?.variantBase === 'string' ? body.variantBase : '';
    const start = Number(body?.start);
    const end = Number(body?.end);
    if (!variantBase || !isFinite(start) || !isFinite(end)) return NextResponse.json({ error: 'variantBase, start, end required' }, { status: 400 });

    const result = setVariantRegion(id, variantBase, start, end);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ ok: true, summary: result.summary });
  }

  return NextResponse.json({ error: 'invalid action' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const guard = requireGrant(req, 'perf:capture');
  if (guard) return guard;

  const id = req.nextUrl.searchParams.get('id') ?? '';
  return NextResponse.json({ ok: deleteComparison(id) });
}
