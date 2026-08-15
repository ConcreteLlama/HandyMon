import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import readline from 'readline';
import { NATIVE_DIR } from './dirs';

// A persistent, elevated native-interop worker — one process, spawned once
// and kept alive for the app's lifetime, queried over stdin/stdout with
// tagged JSON-line requests/responses. Replaces per-poll PowerShell spawns
// for anything that's actually polled (active window, window list,
// per-process CPU/RAM) — each of those used to spawn a fresh powershell.exe
// on every single tick. A one-shot action (switching an audio device, etc.)
// still just spawns PowerShell directly — that's the right tool for
// something invoked rarely; this is for the same handful of queries running
// several times a second.
//
// Source lives in native-src/native-worker.cs, compiled entirely ahead of
// time by scripts/compile-native.js — never at runtime.
//
// Communication is anonymous stdin/stdout pipes created by spawn() — not a
// named pipe or a socket — so nothing outside this specific parent/child
// pair can reach it. It inherits this Node process's elevation the same way
// every other PowerShell interop call in this app already does; the pipe
// itself isn't a new attack surface because nothing else on the machine can
// discover or connect to it.
const EXE_PATH = path.join(NATIVE_DIR, 'native-worker.exe');
const REQUEST_TIMEOUT_MS = 5000;

function ensureExeExists(): void {
  if (!fs.existsSync(EXE_PATH)) {
    throw new Error(`native-worker.exe not found at ${EXE_PATH} — run \`npm run compile-native\` first`);
  }
}

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let child: ChildProcess | null = null;
let nextId = 1;
const pending = new Map<number, PendingRequest>();
let starting: Promise<void> | null = null;

function handleExit(): void {
  child = null;
  // Fail every in-flight request rather than leaving callers hanging until
  // their own timeout — the next query() call respawns automatically.
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error('native worker exited'));
  }
  pending.clear();
}

async function ensureStarted(): Promise<void> {
  if (child) return;
  if (starting) return starting;
  starting = (async () => {
    ensureExeExists();
    const c = spawn(EXE_PATH, [], { windowsHide: true });
    child = c;
    const rl = readline.createInterface({ input: c.stdout! });
    rl.on('line', line => {
      let msg: { id: number; ok: boolean; data?: unknown; error?: string };
      try { msg = JSON.parse(line); } catch { return; }
      const p = pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.data);
      else p.reject(new Error(msg.error || 'native worker error'));
    });
    c.on('exit', handleExit);
    c.on('error', handleExit);
  })();
  try { await starting; } finally { starting = null; }
}

export async function queryNativeWorker<T = unknown>(cmd: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  await ensureStarted();
  if (!child?.stdin) throw new Error('native worker not running');
  const id = nextId++;
  const c = child;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('native worker request timed out'));
    }, timeoutMs);
    pending.set(id, { resolve: resolve as (d: unknown) => void, reject, timer });
    c.stdin!.write(JSON.stringify({ id, cmd }) + '\n');
  });
}
