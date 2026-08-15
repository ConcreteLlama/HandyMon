import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { HELP_HTML_PATH } from '@/utils/dirs';

// Serves the same self-contained help.html the tray icon / Start Menu
// shortcut opens as a local file, but over HTTP — so it's reachable from
// paired devices too (a phone can't open a file:// path on the host PC).
// Single source of truth: one file, two ways in.
export async function GET() {
  try {
    const html = await readFile(HELP_HTML_PATH, 'utf-8');
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch {
    return new NextResponse('<p>Help page not found.</p>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}
