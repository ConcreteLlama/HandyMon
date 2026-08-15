import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from './logger';

const execAsync = promisify(exec);

const PINVOKE_MEMBERS = [
  '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
  '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);',
  '[DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);',
  '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);',
  '[DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();',
  '[DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);',
].join(' ');

// Bring a known window handle ($hwnd must be set before this block) to the
// foreground. Uses AttachThreadInput to bypass Windows' foreground lock, which
// prevents SetForegroundWindow from working when called from a background process.
const ATTACH_FOCUS_BLOCK = `
$fgWin = [PC.WA]::GetForegroundWindow()
$dummy = [uint32]0
$fgThread = [PC.WA]::GetWindowThreadProcessId($fgWin, [ref]$dummy)
$myThread = [PC.WA]::GetCurrentThreadId()
if ($fgThread -ne $myThread) {
  [PC.WA]::AttachThreadInput($fgThread, $myThread, $true) | Out-Null
  [PC.WA]::BringWindowToTop($hwnd) | Out-Null
  [PC.WA]::SetForegroundWindow($hwnd) | Out-Null
  [PC.WA]::AttachThreadInput($fgThread, $myThread, $false) | Out-Null
} else {
  [PC.WA]::BringWindowToTop($hwnd) | Out-Null
  [PC.WA]::SetForegroundWindow($hwnd) | Out-Null
}`.trim();

/** Build a PowerShell script that immediately focuses the window owned by `pid`. */
export function buildFocusByPidScript(pid: number): string {
  return `
try { Add-Type -MemberDefinition '${PINVOKE_MEMBERS}' -Name WA -Namespace PC } catch {}
$p = Get-Process -Id ${pid} -ErrorAction Stop
$hwnd = $p.MainWindowHandle
if ($hwnd -eq [IntPtr]::Zero) { exit 0 }
[PC.WA]::ShowWindow($hwnd, 9) | Out-Null
${ATTACH_FOCUS_BLOCK}
`.trim();
}

/**
 * Build a PowerShell script that waits up to `timeoutSecs` seconds for the
 * process `pid` to show a window, then focuses it (scan mode).
 */
export function buildScanAndFocusScript(pid: number, timeoutSecs = 10): string {
  return `
try { Add-Type -MemberDefinition '${PINVOKE_MEMBERS}' -Name WA -Namespace PC } catch {}
$targetPid = ${pid}
$deadline = (Get-Date).AddSeconds(${timeoutSecs})
$p = $null
while ((Get-Date) -lt $deadline) {
  $p = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
  if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) { break }
  $p = $null
  Start-Sleep -Milliseconds 250
}
if (-not $p) { exit 0 }
$hwnd = $p.MainWindowHandle
[PC.WA]::ShowWindow($hwnd, 9) | Out-Null
${ATTACH_FOCUS_BLOCK}
`.trim();
}

/** Build a PowerShell script that sleeps `delayMs` then focuses the process `pid`. */
export function buildDelayedFocusScript(pid: number, delayMs: number): string {
  return `
try { Add-Type -MemberDefinition '${PINVOKE_MEMBERS}' -Name WA -Namespace PC } catch {}
Start-Sleep -Milliseconds ${delayMs}
$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
if (-not $p) { exit 0 }
$hwnd = $p.MainWindowHandle
if ($hwnd -eq [IntPtr]::Zero) { exit 0 }
[PC.WA]::ShowWindow($hwnd, 9) | Out-Null
${ATTACH_FOCUS_BLOCK}
`.trim();
}


// When PowerShell is spawned via child_process.exec (as every script here is),
// it gets a fresh console with the OS's legacy OEM codepage as its default
// [Console]::OutputEncoding (confirmed live: codepage 850, not UTF-8) — an
// interactive terminal's own PowerShell session usually shows UTF-8 instead,
// which made this look like a dev-vs-installed difference when it was really
// just intermittent (only bit when a window title or similar contained a
// non-ASCII character). Any extended character PowerShell writes gets
// mis-decoded once Node reads stdout as UTF-8, and — found live via a VS Code
// window title with a leaked terminal escape sequence — that mis-decode can
// surface as stray control characters, breaking strict JSON.parse. Forcing
// UTF-8 output up front makes stdout match what Node expects, regardless of
// what console/codepage the child process happened to inherit.
const OUTPUT_ENCODING_PREAMBLE = `try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}`;

/** Encode a PowerShell script as UTF-16LE base64 for use with -EncodedCommand. */
export function encodePsScript(script: string): string {
  return Buffer.from(`${OUTPUT_ENCODING_PREAMBLE}\n${script}`, 'utf16le').toString('base64');
}

// Trimmed for log readability — the full script is often hundreds of lines
// (e.g. embedded C# source) and only the shape matters for debugging.
function scriptPreview(script: string): string {
  return script.length > 300 ? script.slice(0, 300) + '…' : script;
}

/** Run a PowerShell script (passed as plain text) via -EncodedCommand. */
export async function runPsScript(script: string, timeoutMs = 5000): Promise<void> {
  const encoded = encodePsScript(script);
  log.debug('runPsScript', { script: scriptPreview(script), timeoutMs });
  try {
    await execAsync(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
      { timeout: timeoutMs }
    );
  } catch (e: any) {
    log.error('runPsScript failed', { script: scriptPreview(script), error: e.message });
    throw e;
  }
}

/** Run a PowerShell script and JSON-parse its stdout. */
export async function runPsScriptJson<T = unknown>(script: string, timeoutMs = 8000, maxBuffer = 1024 * 1024): Promise<T> {
  const encoded = encodePsScript(script);
  log.debug('runPsScriptJson', { script: scriptPreview(script), timeoutMs });
  let stdout: string;
  try {
    ({ stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
      { timeout: timeoutMs, maxBuffer }
    ));
  } catch (e: any) {
    log.error('runPsScriptJson failed', { script: scriptPreview(script), error: e.message });
    throw e;
  }
  try {
    return JSON.parse(stdout.trim()) as T;
  } catch (e: any) {
    log.error('runPsScriptJson: stdout was not valid JSON', { script: scriptPreview(script), stdout: stdout.slice(0, 500) });
    throw e;
  }
}

// Native-interop C# (audio/display/native-worker/tray) is compiled entirely
// ahead of time by scripts/compile-native.js from source under native-src/ —
// never at runtime. See dirs.ts's NATIVE_DIR for where the compiled output
// is expected to live for a given run mode.
