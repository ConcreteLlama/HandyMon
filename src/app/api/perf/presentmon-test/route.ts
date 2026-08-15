import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import path from 'path';
import { probePresentMon } from '@/utils/presentmon';
import { requireGrant } from '@/utils/grants';

// Validates an optional typed PresentMon path and reports live capture status.
// Runs server-side (host) so a remote browser needn't reach anything itself.
export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'settings:write');
  if (guard) return guard;

  const typed = (req.nextUrl.searchParams.get('path') ?? '').trim();
  if (typed) {
    if (!existsSync(typed)) {
      return NextResponse.json({ ok: false, detail: 'path does not exist' });
    }
    if (!/presentmon/i.test(path.basename(typed))) {
      return NextResponse.json({ ok: false, detail: "that file doesn't look like PresentMon" });
    }
  }
  // Live capture status (reflects the saved config; typed path applies after save).
  return NextResponse.json(probePresentMon());
}
