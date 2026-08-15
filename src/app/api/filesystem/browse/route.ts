import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { localhostOnly } from '@/utils/request-utils';
import type { BrowseEntry, BrowseResult } from '@/types/filesystem';

const EXEC_EXTS = new Set(['.exe', '.bat', '.cmd', '.ps1', '.msi']);

export async function GET(req: NextRequest) {
  const guard = localhostOnly(req);
  if (guard) return guard;

  const browsePath = req.nextUrl.searchParams.get('path') ?? 'C:\\';

  // Use Windows env vars instead of os.homedir() — @vercel/nft would statically
  // resolve os.homedir() to a real path and scan AppData, hitting a Windows
  // junction that causes an EPERM build error. Env vars are not dereferenced.
  const userProfile  = process.env['USERPROFILE'] ?? '';
  const appDataRoam  = process.env['APPDATA'] ?? '';
  const appDataLocal = process.env['LOCALAPPDATA'] ?? '';

  const candidates = [
    { label: 'Program Files',       path: 'C:\\Program Files' },
    { label: 'Program Files (x86)', path: 'C:\\Program Files (x86)' },
    userProfile  ? { label: 'Desktop',          path: path.join(userProfile, 'Desktop') } : null,
    appDataRoam  ? { label: 'AppData\\Roaming', path: appDataRoam }  : null,
    appDataLocal ? { label: 'AppData\\Local',   path: appDataLocal } : null,
  ].filter(Boolean) as { label: string; path: string }[];

  // Use async access so nft doesn't try to follow the resolved paths
  const quickAccess = (
    await Promise.all(candidates.map(async q => {
      try { await fs.promises.access(q.path); return q; } catch { return null; }
    }))
  ).filter(Boolean) as { label: string; path: string }[];

  try {
    const raw = await fs.promises.readdir(browsePath, { withFileTypes: true });
    const entries: BrowseEntry[] = raw
      .filter(e => !e.name.startsWith('$') && !e.name.startsWith('.'))
      .map(e => {
        const ext = path.extname(e.name).toLowerCase();
        return {
          name: e.name,
          path: path.join(browsePath, e.name),
          type: (e.isDirectory() ? 'directory' : EXEC_EXTS.has(ext) ? 'executable' : 'file') as BrowseEntry['type'],
        };
      })
      .sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

    const normalized = path.normalize(browsePath);
    const parent = path.dirname(normalized);

    return NextResponse.json({
      path: normalized,
      parent: parent !== normalized ? parent : null,
      entries,
      quickAccess,
    } satisfies BrowseResult);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
