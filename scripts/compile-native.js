#!/usr/bin/env node
// Compiles every native-interop C# source under native-src/ into DLLs/exe via
// PowerShell Add-Type — the *only* place any of this ever gets compiled.
// Runtime code (native-audio.ts, native-display.ts, native-worker.ts,
// tray-native.js) only ever loads an already-compiled file; if one's
// missing, that's a real setup error, not something the app tries to fix
// itself. See dirs.ts's NATIVE_DIR for where the output actually needs to
// land for a given run mode (dev vs. git-checkout production vs. packaged).
//
// Usage: node scripts/compile-native.js [--out <dir>]
//   --out defaults to <repo-root>/native — used by the predev/prebuild npm
//   hooks (dev and git-checkout production both resolve NATIVE_DIR there).
//   scripts/package-win.js calls this with --out pointed at the staged
//   build directory instead, so the packaged installer ships already-built
//   binaries rather than ever compiling on the end user's machine.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(REPO_ROOT, 'native-src');

const outArg = process.argv.indexOf('--out');
const OUT_DIR = outArg !== -1 && process.argv[outArg + 1]
  ? path.resolve(process.argv[outArg + 1])
  : path.join(REPO_ROOT, 'native');

function log(msg) { console.log(`[compile-native] ${msg}`); }

const MODULES = [
  { cs: 'audio-interop.cs',   out: 'audio-interop.dll',   outputType: 'Library',           refs: [] },
  { cs: 'display-interop.cs', out: 'display-interop.dll', outputType: 'Library',           refs: ['System.Web.Extensions.dll'] },
  { cs: 'native-worker.cs',   out: 'native-worker.exe',   outputType: 'ConsoleApplication', refs: ['System.Web.Extensions.dll', 'System.Management.dll'] },
  { cs: 'tray-interop.cs',    out: 'tray-interop.dll',    outputType: 'Library',           refs: ['System.Windows.Forms', 'System.Drawing'] },
];

function encodePsScript(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function compile({ cs, out, outputType, refs }) {
  const csPath = path.join(SRC_DIR, cs);
  const outPath = path.join(OUT_DIR, out);
  if (!fs.existsSync(csPath)) throw new Error(`missing source: ${csPath}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  try { fs.unlinkSync(outPath); } catch { /* nothing to remove */ }

  const escCs = csPath.replace(/\\/g, '\\\\');
  const escOut = outPath.replace(/\\/g, '\\\\');
  const refsArg = refs.length ? ` -ReferencedAssemblies ${refs.map(r => `"${r}"`).join(',')}` : '';
  const outputTypeArg = outputType !== 'Library' ? ` -OutputType ${outputType}` : '';
  // $ProgressPreference suppresses PowerShell's own module-loading progress
  // records, which otherwise get serialized as raw CLIXML noise on stdout
  // when run non-interactively via -EncodedCommand.
  const script = `$ProgressPreference = 'SilentlyContinue'\nAdd-Type -TypeDefinition (Get-Content "${escCs}" -Raw) -Language CSharp -OutputAssembly "${escOut}"${refsArg}${outputTypeArg}`;

  log(`compiling ${cs} -> ${path.relative(REPO_ROOT, outPath)}...`);
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodePsScript(script)], {
    stdio: 'inherit',
    timeout: 15000,
  });
}

for (const m of MODULES) compile(m);
log(`done — ${MODULES.length} assemblies in ${OUT_DIR}`);
