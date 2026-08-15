import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { requireGrant } from '@/utils/grants';

const execAsync = promisify(exec);
const Body = z.object({ pid: z.number().int().positive() });

export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'processes:kill');
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  try {
    const { stdout, stderr } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "Stop-Process -Id ${parsed.data.pid} -Force -ErrorAction Stop"`,
      { timeout: 5000 }
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
