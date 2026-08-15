import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { requireGrant } from '@/utils/grants';
import { encodePsScript } from '@/utils/windows';

const execAsync = promisify(exec);
const Body = z.object({ program: z.string() });

export async function POST(req: NextRequest) {
  const guard = requireGrant(req, 'actions:edit');
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const program = parsed.data.program.replace(/'/g, "''");
  const script = [
    'Add-Type -AssemblyName System.Drawing',
    `$icon = [System.Drawing.Icon]::ExtractAssociatedIcon('${program}')`,
    '$bmp = $icon.ToBitmap()',
    '$ms = New-Object System.IO.MemoryStream',
    '$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)',
    '[System.Convert]::ToBase64String($ms.ToArray())',
  ].join('; ');

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encodePsScript(script)}`,
      { timeout: 5000 }
    );
    const b64 = stdout.trim();
    if (!b64) return NextResponse.json({ icon: null });
    return NextResponse.json({ icon: `data:image/png;base64,${b64}` });
  } catch {
    return NextResponse.json({ icon: null });
  }
}
