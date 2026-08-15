import { spawn, execSync, ChildProcess } from 'child_process';
import { existsSync, readdirSync, readFileSync, unlinkSync } from 'fs';
import os from 'os';
import path from 'path';
import { getAppConfig } from '@/utils/app-config';
import { captureBaseName, csvPath, finalizeCapture, ensureCapturesDir, CAPTURES_DIR } from '@/utils/captures';
import { captureSensorSampler } from '@/utils/capture-sensors';
import { PRESENTMON_DIR } from '@/utils/dirs';
import type { CaptureRunStatus, CaptureRunSummary } from '@/types/perf';

// ── PresentMon FPS source (ETW frametime capture) ────────────────────────────
// PresentMon streams one CSV row per graphics present. Unlike the old Afterburner
// feed (pull via HTTP each poll), this is a long-running push stream, so a
// module-level singleton owns a persistent capture process and maintains a
// rolling frametime window that the stats route reads synchronously.
//
// Requires the host process to be elevated (realtime ETW session) — the
// "HandyMon" scheduled task runs HighestAvailable, so this is satisfied.

export interface GpuFramerate {
  framerateFps:      number | null;
  framerateAvg:      number | null;
  framerate1pctLow:  number | null;
  framerate01pctLow: number | null;
  frameTimeMs:       number | null;
  // Seconds since the last reset (manual RESET, capture restart, idle-stop,
  // game exit/relaunch) — the actual timeframe AVG/lows/HITCHES/consistency
  // below cover, since there was previously no visible indication of that
  // anywhere short of doing the math yourself.
  sessionSeconds:    number | null;
  hitches:           number | null; // frames since reset markedly above local cadence
  // Raw frametime (ms) of the single worst hitch this session — HITCHES is
  // a count, this is severity ("12 hitches" reads very differently if the
  // worst was 15ms vs 60ms). Not literal MIN/MAX FPS — those were dropped
  // (see presentmon.ts's getFramerate comment) since a single anomalous
  // frame (frame-gen insertion, ETW timestamp noise) could make them read
  // wildly, misleadingly high/low; 1%/0.1% LOW already cover "how bad does
  // it get" the statistically-robust way every serious frame-time tool uses.
  worstHitchMs:      number | null;
  // Std deviation of frametime across the session (ms) — smoothness/pacing,
  // independent of and complementary to AVG and the percentile lows: two
  // sessions can share identical AVG/1%LOW but feel completely different if
  // one has steady small variance and the other alternates smooth/juddery.
  frameTimeStdDevMs: number | null;
  gpuBusyPct:        number | null; // avg GPU-active time / frametime — CPU vs GPU bound
  displayLatencyMs:  number | null; // avg present→display latency
  inputLatencyMs:    number | null; // avg input→present latency (if the game reports it)
  // Estimate only — PresentMon's official FrameType/app-timing instrumentation
  // doesn't report on every title (confirmed absent on some titles even with
  // Frame Generation active). This is a heuristic off present-timing pattern.
  frameGenLikely:        boolean;
  frameGenMultiplierEst: number | null;
  // Whether the resolved PresentMon build's CSV actually reports
  // msBetweenDisplayChange (NVIDIA's DLSS4 flip-metering column) — a hard
  // fact from the CSV header, not a heuristic like frameGenLikely above.
  // false on a plain build; frame pacing still works either way, this only
  // affects whether msBetweenDisplayChange reflects true flip cadence.
  flipMeteringSupported: boolean;
}

export const EMPTY_FRAMERATE: GpuFramerate = {
  framerateFps: null, framerateAvg: null,
  framerate1pctLow: null, framerate01pctLow: null, frameTimeMs: null, sessionSeconds: null, hitches: null,
  worstHitchMs: null, frameTimeStdDevMs: null,
  gpuBusyPct: null, displayLatencyMs: null, inputLatencyMs: null,
  frameGenLikely: false, frameGenMultiplierEst: null, flipMeteringSupported: false,
};

const SESSION_NAME = 'PcControlWeb';
const ACTIVE_S     = 1;      // window (seconds) for picking the active process
const MAX_FRAMES   = 60000;  // per-process session buffer cap (~8 min @120fps) — bounds memory
const IDLE_PROC_S  = 60;     // drop a process's buffer this long after it stops presenting
const STALE_MS     = 4000;   // no CSV rows for this long ⇒ capture considered dead
const RESTART_MS   = 3000;   // backoff before respawning a died capture
// Stop capture when the perf view stops polling — but generous enough that a
// phone briefly locking (mobile browsers throttle/suspend background tab
// polling, sometimes for well over 30s) doesn't wipe the running session's
// accumulated stats just from a quick screen check. Still frees the ETW
// capture during genuine extended absence.
const IDLE_STOP_MS = 180000;
const WATCHDOG_MS  = 10000;  // idle-check interval
const RUN_MAX_MIN    = 20;     // hard cap on a run's length (PresentMon --timed backstop)
const RUN_AUTOEND_S  = 3;      // end a run if the pinned process goes quiet this long

// Processes that always present but are never "the game" — user-editable
// list (AppConfig.processExclusions, seeded with Windows shell/UI-host
// noise), not a hardcoded set. Each entry is a regex source string matched
// case-insensitively against the lowercased exe name; a quick-exclude from
// the picker adds an escaped (exact) pattern, hand-edited entries (Manage
// Exclusions dialog) can be broader. Config reads are already in-process
// cached (see app-config.ts), so recompiling on every call here is cheap —
// this only ever runs a handful of times per second, over a handful of
// patterns.
function isProcessExcluded(key: string): boolean {
  const patterns = getAppConfig().processExclusions ?? [];
  for (const p of patterns) {
    try { if (new RegExp(p, 'i').test(key)) return true; } catch { /* invalid pattern — ignore, not exclude-everything */ }
  }
  return false;
}

interface Present { t: number; ft: number; rawFt?: number; app: string; pid?: number; gpu?: number; disp?: number; input?: number; }

// A process the user can manually pin the live view to — see the `pinned*`
// fields on PresentMonCapture below. `excluded` reflects the current
// processExclusions config so the picker can grey it out and sort it last —
// deliberately not filtered OUT of the list entirely (manually pinning is
// the escape hatch for whatever auto-detect skips).
export interface PresentMonCandidate { key: string; displayName: string; pid: number | null; recentFrames: number; excluded: boolean; }

interface RunState {
  key: string;                    // lowercased pinned process
  displayName: string;
  base: string;                   // capture filename base
  dir: string;                    // output dir — CAPTURES_DIR for a standalone capture, a comparisons/<id>/ folder for a Variant
  startWall: number;
  startedAt: number;              // unix ms
  child: ChildProcess | null;     // dedicated capture PresentMon (writes the CSV)
  lastFrameT: number;             // last time the pinned process presented (streaming), for auto-end
  reason?: string;                // set once when ending
  ended: boolean;
  summary: CaptureRunSummary | null;
  onFinalize?: (summary: CaptureRunSummary | null) => void; // lets comparisons.ts hook a Variant's completion without this class knowing comparisons exist
}

// Kill a stale realtime ETW session by name — a PresentMon that was killed
// (not gracefully stopped) leaves its session running, and a later PresentMon
// with the same -session_name stops it but then won't reuse the name, so it
// never starts capturing. Clearing it first guarantees a clean start.
function stopEtwSession(name: string): void {
  try { execSync(`logman stop "${name}" -ets`, { windowsHide: true, stdio: 'ignore', timeout: 3000 }); } catch { /* not running */ }
}

function detectMajorVersion(exe: string): number {
  const m = path.basename(exe).match(/[-_ ](\d+)\.\d+/);
  return m ? parseInt(m[1], 10) : 2; // unknown ⇒ assume modern 2.x
}

// Dirs where PresentMon binaries commonly live (CapFrameX / RTSS bundle them).
const PM_DIRS = [
  'C:\\Program Files (x86)\\CapFrameX\\PresentMon',
  'C:\\Program Files (x86)\\RivaTuner Statistics Server\\Plugins\\Client\\PresentMonDataProvider',
];
const PM_FIXED = ['C:\\Program Files\\NVIDIA Corporation\\FrameViewSDK\\bin\\PresentMon_x64.exe'];

function pmVersion(file: string): { major: number; minor: number } | null {
  const m = path.basename(file).match(/[-_ ](\d+)\.(\d+)/);
  return m ? { major: parseInt(m[1], 10), minor: parseInt(m[2], 10) } : null;
}

// Our --v1_metrics / --output_stdout flag set works on 1.x and, contrary to
// this comment's original assumption that 2.4 broke it, still works through
// at least 2.5.1 — confirmed 2026-08-09 with a real 2.5.1 binary via
// diagnosticProbe(): --v1_metrics parses fine and its CSV already reports
// msBetweenDisplayChange (DLSS4 flip-metering), no NVIDIA-patched build
// needed. --v2_metrics uses an incompatible column schema (FrameTime/
// CPUBusy/DisplayLatency instead of msBetweenPresents/msUntilDisplayed/
// msBetweenDisplayChange) for no benefit v1 doesn't already cover here —
// not worth the parser rewrite. Bump the ceiling as newer releases get
// verified working.
function pmCompatible(v: { major: number; minor: number } | null): boolean {
  return !!v && (v.major === 1 || (v.major === 2 && v.minor <= 5));
}

// Our own bundled copy — decoupled from CapFrameX/RTSS, which update and break us.
const APP_PM_DIR = PRESENTMON_DIR;

function presentMonExesIn(dir: string): string[] {
  try { return readdirSync(dir).filter(f => /^presentmon.*\.exe$/i.test(f)).map(f => path.join(dir, f)); }
  catch { return []; }
}

// NVIDIA's "-DLSS4" builds report more accurate frame-gen (flip-metering) frame
// pacing than a plain build — prefer them when present. A plain build still
// works fine either way; flip-metering just doesn't activate without it.
const variantRank = (f: string) => (/dlss/i.test(f) ? 0 : 1);
function byVerDesc(a: string, b: string): number {
  const va = pmVersion(a), vb = pmVersion(b);
  return ((vb?.major ?? 0) - (va?.major ?? 0)) || ((vb?.minor ?? 0) - (va?.minor ?? 0)) || (variantRank(a) - variantRank(b));
}

// Highest-compatible exe from a list; falls back to whatever exists.
function pickBest(exes: string[]): string | null {
  const compatible = exes.filter(e => pmCompatible(pmVersion(e))).sort(byVerDesc);
  if (compatible.length) return compatible[0];
  return exes.sort(byVerDesc)[0] ?? null;
}

function allPresentMonExes(): string[] {
  const found: string[] = [];
  for (const dir of PM_DIRS) found.push(...presentMonExesIn(dir));
  for (const f of PM_FIXED) if (existsSync(f)) found.push(f);
  return found;
}

class PresentMonCapture {
  private child: ChildProcess | null = null;
  private starting = false;
  private restartAt = 0;
  private headerParsed = false;
  private cols: Record<string, number> = {};
  private buf = '';
  private lastDataMs = 0;
  private maxT = 0;
  private byProc = new Map<string, Present[]>();
  private resolvedExe: string | null = null;
  private lastRequestMs = 0;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private run: RunState | null = null;
  private lastArgs: string[] = [];      // debug: args of the current streaming spawn
  private lastStderr = '';              // debug: recent stderr from PresentMon
  private stdoutSample = '';            // debug: first bytes of stdout

  // Manual override for which process the live view treats as "the game" —
  // set via pinProcess() (the process picker). Survives capture restarts and
  // stats resets (neither touches these fields); only clears when the pinned
  // PID actually exits (checked in activeProcess() below) or the user
  // explicitly unpins. Deliberately not persisted to config — a pin reflects
  // "auto-detection got it wrong for this session", not a standing
  // preference, so it doesn't outlive the process it points at.
  private pinnedKey: string | null = null;
  private pinnedPid: number | null = null;
  private pinnedDisplayName: string | null = null;

  resolveExe(): string | null {
    const configured = getAppConfig().presentMonPath?.trim();
    if (configured && existsSync(configured)) return configured;  // 1) explicit override
    const owned = pickBest(presentMonExesIn(APP_PM_DIR));
    if (owned) return owned;                                       // 2) our bundled copy
    return pickBest(allPresentMonExes());                         // 3) discover from CapFrameX/RTSS/FrameView
  }

  available(): boolean {
    return this.child !== null && this.headerParsed && (Date.now() - this.lastDataMs) < STALE_MS;
  }

  ensureStarted(): void {
    this.lastRequestMs = Date.now();
    this.ensureWatchdog();
    if (this.child || this.starting) return;
    if (Date.now() < this.restartAt) return;
    const exe = this.resolveExe();
    if (!exe) return;
    this.starting = true;
    try {
      const major = detectMajorVersion(exe);
      const args = major >= 2
        ? ['--v1_metrics', '--output_stdout', '--stop_existing_session', '--session_name', SESSION_NAME]
        : ['-output_stdout', '-captureall', '-no_top', '-stop_existing_session', '-session_name', SESSION_NAME];
      stopEtwSession(SESSION_NAME); // clear any stale session before starting
      const child = spawn(exe, args, { windowsHide: true });
      this.resolvedExe = exe;
      this.child = child;
      this.lastArgs = args;
      this.lastStderr = '';
      this.stdoutSample = '';
      this.headerParsed = false;
      this.cols = {};
      this.buf = '';
      // PresentMon's TimeInSeconds restarts at 0 each spawn — reset our clock and
      // buffer too, or every new frame looks "ancient" vs a stale maxT and gets
      // swept, breaking capture after any respawn (idle-stop, crash, lock/unlock).
      this.maxT = 0;
      this.byProc.clear();

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => this.onData(chunk));
      child.stderr.on('data', (d: Buffer) => { this.lastStderr = (this.lastStderr + d.toString()).slice(-800); });
      const onGone = () => {
        if (this.child === child) {
          this.child = null;
          this.headerParsed = false;
          this.restartAt = Date.now() + RESTART_MS;
        }
      };
      child.on('exit', onGone);
      child.on('error', onGone);
    } finally {
      this.starting = false;
    }
  }

  // Stop the capture when nobody's watching the perf view; it lazily restarts
  // on the next stats request. Keeps ETW off when idle.
  private ensureWatchdog(): void {
    if (this.idleTimer) return;
    this.idleTimer = setInterval(() => {
      if (!this.child) return;
      const now = Date.now();
      if (now - this.lastRequestMs > IDLE_STOP_MS) { this.stop(); return; } // nobody watching
      // Alive but silent too long ⇒ hung capture (dwm always presents, so real
      // captures never go quiet); drop it so the next poll respawns a clean one.
      if (this.headerParsed && now - this.lastDataMs > STALE_MS * 2) this.stop();
    }, WATCHDOG_MS);
    this.idleTimer.unref?.();
  }

  private stop(): void {
    const c = this.child;
    this.child = null;
    this.headerParsed = false;
    this.buf = '';
    this.byProc.clear();
    this.maxT = 0;
    if (c) { try { c.kill(); } catch { /* already gone */ } }
  }

  private onData(chunk: string) {
    if (this.stdoutSample.length < 800) this.stdoutSample += chunk;
    this.buf += chunk;
    let nl: number;
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl).replace(/\r$/, '');
      this.buf = this.buf.slice(nl + 1);
      if (line) this.onLine(line);
    }
  }

  private onLine(line: string) {
    const fields = line.split(',');
    if (!this.headerParsed) {
      // The header row names the columns (order varies by PresentMon version).
      if (/application/i.test(line) && /msbetweenpresents/i.test(line)) {
        this.cols = {};
        fields.forEach((name, i) => { this.cols[name.trim().toLowerCase()] = i; });
        this.headerParsed = true;
      }
      return;
    }
    const ci = this.cols;
    const app = fields[ci['application']];
    // msBetweenDisplayChange (when present) reflects actual on-screen flip
    // cadence — including driver-generated frame-gen frames on flip-metering-
    // aware PresentMon builds — vs. msBetweenPresents' raw Present() timing.
    // Falls back to msBetweenPresents on any build that doesn't report it.
    const ft  = parseFloat(fields[ci['msbetweendisplaychange'] ?? ci['msbetweenpresents']]);
    const t   = parseFloat(fields[ci['timeinseconds']]);
    const dropped = fields[ci['dropped']] === '1';
    // Bound frametimes to a plausible range (0.5ms–2000ms ≈ 2000–0.5 fps) so
    // capture artifacts (near-zero back-to-back presents, multi-second gaps)
    // don't pollute min / max / 1% lows.
    if (!app || dropped || !isFinite(ft) || !isFinite(t) || ft < 0.5 || ft > 2000) return;

    this.lastDataMs = Date.now();
    if (t > this.maxT) this.maxT = t;

    const gpu   = parseFloat(fields[ci['msgpuactive']]);
    const disp  = parseFloat(fields[ci['msuntildisplayed']]);
    const input = parseFloat(fields[ci['mssinceinput']]);
    // Raw Present() timing (unlike ft above, never substituted) — the frame-gen
    // heuristic needs this specifically: a real frame followed by a cheap
    // generated one shows up as an anomalously fast raw present gap.
    const rawFt = parseFloat(fields[ci['msbetweenpresents']]);
    // PID — used only for the manual-pin liveness check (see isPidAlive), not
    // for bucketing (byProc is still keyed by process name, same as before).
    const pid = parseInt(fields[ci['processid']], 10);

    const present: Present = {
      t, ft, app,
      pid:   isFinite(pid)   && pid   >  0 ? pid   : undefined,
      rawFt: isFinite(rawFt) && rawFt > 0 ? rawFt : undefined,
      gpu:   isFinite(gpu)   && gpu   >= 0 ? gpu   : undefined,
      disp:  isFinite(disp)  && disp  >  0 ? disp  : undefined,
      input: isFinite(input) && input >  0 ? input : undefined,
    };

    const key = app.toLowerCase();
    let arr = this.byProc.get(key);
    if (!arr) { arr = []; this.byProc.set(key, arr); }
    arr.push(present);
    // Session buffer (cleared by reset / on program switch) — cap to bound memory.
    if (arr.length > MAX_FRAMES) arr.splice(0, arr.length - MAX_FRAMES);

    // Capture-run auto-end: the dedicated PresentMon writes the CSV; we only watch
    // the streaming feed to end the run when the pinned process goes quiet.
    if (this.run && !this.run.ended) {
      if (key === this.run.key) this.run.lastFrameT = t;
      if (this.maxT - this.run.lastFrameT > RUN_AUTOEND_S) this.endRun('process changed / exited');
    }
  }

  reset(): void {
    this.byProc.clear();
  }

  // Kill and respawn the streaming capture (picks up a changed presentMonPath /
  // recovers a stuck capture). Safe to call anytime.
  forceRestart(): void {
    this.stop();
    this.restartAt = 0;
    this.ensureStarted();
  }

  // Remove processes that have stopped presenting so byProc can't grow unbounded
  // over a long session (per-process arrays are already pruned on insert).
  // The pinned process is exempt — a long loading screen or a paused/idle game
  // can easily go quiet longer than IDLE_PROC_S, and losing its buffer would
  // needlessly wipe the AVG/MIN/MAX/etc it had built up; PID liveness (see
  // isPidAlive) is what actually decides whether the pin should end, not idle time.
  private sweepStale(): void {
    const cutoff = this.maxT - IDLE_PROC_S;
    for (const [key, arr] of this.byProc) {
      if (key === this.pinnedKey) continue;
      if (!arr.length || arr[arr.length - 1].t < cutoff) this.byProc.delete(key);
    }
  }

  // Zero-cost liveness check — process.kill(pid, 0) doesn't send a signal, it
  // just asks the OS whether the PID still exists, with no subprocess spawn.
  // Safe to call every poll tick, unlike the PowerShell-based checks
  // elsewhere in this app (foreground window, full exe path, etc).
  private isPidAlive(pid: number): boolean {
    try { process.kill(pid, 0); return true; } catch { return false; }
  }

  // Pick the process the live view treats as "the game": the manual pin if
  // one is set and still alive, otherwise the non-excluded process presenting
  // most in the recent instant window (unchanged auto-detect heuristic).
  private activeProcess(): Present[] | null {
    if (this.pinnedKey !== null) {
      if (this.pinnedPid !== null && !this.isPidAlive(this.pinnedPid)) {
        this.pinnedKey = null;
        this.pinnedPid = null;
        this.pinnedDisplayName = null;
      } else {
        return this.byProc.get(this.pinnedKey) ?? null;
      }
    }

    const instantCut = this.maxT - ACTIVE_S;
    let best: Present[] | null = null;
    let bestCount = 0;
    for (const [key, arr] of this.byProc) {
      if (isProcessExcluded(key)) continue;
      const recent = arr.filter(p => p.t >= instantCut).length;
      if (recent > bestCount) { bestCount = recent; best = arr; }
    }
    return bestCount > 0 ? best : null;
  }

  // ── Manual process pin (process picker) ─────────────────────────────────────

  // key/displayName come straight from a listCandidateProcesses() snapshot —
  // pid is optional (a candidate might lack it if that CSV row never carried
  // a parseable ProcessID) and, if absent, the pin just never auto-clears on
  // its own — still fine, the user can always unpin manually.
  pinProcess(key: string, displayName: string, pid: number | null): void {
    this.pinnedKey = key.toLowerCase();
    this.pinnedDisplayName = displayName;
    this.pinnedPid = pid;
  }

  unpinProcess(): void {
    this.pinnedKey = null;
    this.pinnedPid = null;
    this.pinnedDisplayName = null;
  }

  // Runs the same liveness check activeProcess() does, so a pin that died
  // since the last poll is reflected immediately rather than on the next tick.
  getPinnedProcess(): { displayName: string } | null {
    this.activeProcess();
    return this.pinnedKey !== null ? { displayName: this.pinnedDisplayName! } : null;
  }

  // Snapshot of everything currently presenting, ranked by recent frame count
  // — the process picker's candidate list. Deliberately unfiltered (not
  // removed) by exclusion: manually pinning is the escape hatch for whatever
  // auto-detection won't (or, per processExclusions, deliberately doesn't)
  // pick on its own — excluded entries just sort last and get greyed out
  // client-side.
  listCandidateProcesses(): PresentMonCandidate[] {
    const instantCut = this.maxT - ACTIVE_S;
    const out: PresentMonCandidate[] = [];
    for (const [key, arr] of this.byProc) {
      if (!arr.length) continue;
      const recentFrames = arr.filter(p => p.t >= instantCut).length;
      const last = arr[arr.length - 1];
      out.push({ key, displayName: last.app, pid: last.pid ?? null, recentFrames, excluded: isProcessExcluded(key) });
    }
    out.sort((a, b) => (Number(a.excluded) - Number(b.excluded)) || (b.recentFrames - a.recentFrames));
    return out;
  }

  getFramerate(): GpuFramerate {
    this.lastRequestMs = Date.now();
    this.sweepStale();
    if (!this.available()) return EMPTY_FRAMERATE;
    const arr = this.activeProcess();
    if (!arr || arr.length === 0) return EMPTY_FRAMERATE;

    const instantS = Math.max(0.1, (getAppConfig().fpsWindowMs ?? 1000) / 1000);
    const instantCut = this.maxT - instantS;
    const frames = arr;                                         // full session buffer (since reset)
    const instantFrames = arr.filter(p => p.t >= instantCut);
    const fts = frames.map(p => p.ft);
    const avgFtAll = fts.reduce((a, b) => a + b, 0) / fts.length;
    const span = frames[frames.length - 1].t - frames[0].t;

    const fpsInstant = instantFrames.length >= 2 ? instantFrames.length / instantS : null;
    const fpsAvg     = span > 0 ? frames.length / span : null;

    const sorted = [...fts].sort((a, b) => a - b);              // frametimes ascending
    const pctFt = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1))] : null;
    const low1  = pctFt(99);
    const low01 = pctFt(99.9);

    // Frame time consistency (std deviation, ms) — pacing/smoothness,
    // independent of AVG: two sessions can share identical AVG and 1% LOW
    // but feel completely different if one has steady small variance and
    // the other alternates smooth/juddery. Whole-session like AVG (not
    // windowed) — as an aggregate over every frame, unlike a single-value
    // extremum it isn't vulnerable to permanent poisoning by one outlier.
    const variance = fts.reduce((sum, f) => sum + (f - avgFtAll) ** 2, 0) / fts.length;
    const frameTimeStdDevMs = Math.round(Math.sqrt(variance) * 100) / 100;

    // Hitches: isolated frames well above the *local* cadence. Each frame is
    // compared to a rolling average of the preceding frames, so genuine spikes
    // are counted while smooth-but-slow sections are not (once a slowdown
    // persists, the local average catches up and frames stop being flagged).
    const HITCH_WINDOW = 20;   // frames of local context
    const HITCH_FLOOR_MS = 4;  // must also be this many ms above local avg
    const threshold = Math.max(1.2, getAppConfig().hitchThreshold ?? 2);
    let hitches = 0;
    let worstHitchMs: number | null = null; // raw frametime of the worst flagged hitch — how long the stall actually was
    let rollSum = 0;
    const roll: number[] = [];
    for (const f of fts) {
      if (roll.length >= HITCH_WINDOW) {
        const localAvg = rollSum / roll.length;
        if (f > localAvg * threshold && f > localAvg + HITCH_FLOOR_MS) {
          hitches++;
          if (worstHitchMs === null || f > worstHitchMs) worstHitchMs = f;
        }
      }
      roll.push(f);
      rollSum += f;
      if (roll.length > HITCH_WINDOW) rollSum -= roll.shift()!;
    }

    // GPU-bound %, present→display latency, input latency (avg over the buffer).
    const gpuVals = frames.map(p => p.gpu).filter((v): v is number => v !== undefined);
    const gpuBusyPct = (gpuVals.length && avgFtAll > 0)
      ? Math.min(100, Math.round((gpuVals.reduce((a, b) => a + b, 0) / gpuVals.length) / avgFtAll * 100))
      : null;
    const avgOf = (vals: number[]) => vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
    const displayLatencyMs = avgOf(frames.map(p => p.disp).filter((v): v is number => v !== undefined));
    const inputLatencyMs   = avgOf(frames.map(p => p.input).filter((v): v is number => v !== undefined));

    // Frame-gen heuristic (estimate — see GpuFramerate comment). A real frame
    // immediately followed by a cheap generated one shows up as a raw present
    // gap well below the recent local average; count how often that happens
    // over a fixed-size recent window (frame-count based, not time-based, so
    // it's unaffected by the user's configurable smoothing/poll settings).
    const FG_WINDOW_SIZE = 90;    // recent frames considered
    const FG_ROLL         = 20;   // local-average window for the "is this fast" check
    const FG_FAST_RATIO   = 0.4;  // gap below this fraction of local avg looks inserted
    const FG_MIN_SAMPLES  = 20;   // need this many comparisons before trusting the ratio
    const FG_MIN_FRACTION = 0.15; // below this, treat as noise / not detected
    const fgSample = frames.slice(-FG_WINDOW_SIZE).map(p => p.rawFt).filter((v): v is number => v !== undefined);
    let fgFast = 0, fgCompared = 0, fgRollSum = 0;
    const fgRoll: number[] = [];
    for (const v of fgSample) {
      if (fgRoll.length >= FG_ROLL) {
        const localAvg = fgRollSum / fgRoll.length;
        fgCompared++;
        if (v < localAvg * FG_FAST_RATIO) fgFast++;
      }
      fgRoll.push(v);
      fgRollSum += v;
      if (fgRoll.length > FG_ROLL) fgRollSum -= fgRoll.shift()!;
    }
    const fgFraction = fgCompared >= FG_MIN_SAMPLES ? fgFast / fgCompared : 0;
    const frameGenLikely = fgFraction >= FG_MIN_FRACTION;
    const frameGenMultiplierEst = frameGenLikely && fgFast < fgCompared
      ? Math.round((fgCompared / (fgCompared - fgFast)) * 10) / 10
      : null;

    const clampFps = (v: number | null) => (v !== null && isFinite(v) && v > 0 && v <= 1000) ? Math.round(v) : null;

    return {
      framerateFps:      clampFps(fpsInstant),
      framerateAvg:      clampFps(fpsAvg),
      framerate1pctLow:  clampFps(low1  ? 1000 / low1  : null),
      framerate01pctLow: clampFps(low01 ? 1000 / low01 : null),
      frameTimeMs:       Math.round(fts[fts.length - 1] * 100) / 100,
      sessionSeconds:    Math.round(span),
      hitches,
      worstHitchMs: worstHitchMs !== null ? Math.round(worstHitchMs * 100) / 100 : null,
      frameTimeStdDevMs,
      gpuBusyPct,
      displayLatencyMs,
      inputLatencyMs,
      frameGenLikely,
      frameGenMultiplierEst,
      flipMeteringSupported: this.cols['msbetweendisplaychange'] !== undefined,
    };
  }

  // Name of the process currently being monitored (the active presenter), if any.
  // When pinned, always shows the pinned display name — even mid-loading-screen
  // with an empty buffer — rather than falling silent just because arr is empty.
  activeProcessName(): string | null {
    if (!this.available()) return null;
    const arr = this.activeProcess();
    if (this.pinnedKey !== null) return this.pinnedDisplayName;
    return arr && arr.length ? arr[0].app : null;
  }

  // ── Capture run (benchmark pinned to one process) ──────────────────────────

  // `opts.dir` defaults to the flat CAPTURES_DIR; comparisons.ts passes its
  // own comparisons/<id>/ folder so a Variant's files land there instead,
  // reusing this entire capture pipeline unmodified. `opts.onFinalize` fires
  // once doFinalize() has a summary — comparisons.ts uses it to record that
  // Variant's result in the comparison's manifest, without this class
  // needing to know comparisons exist at all. `opts.maxDurationS` — used by
  // a Comparison's "match the first variant's duration" option — replaces
  // the default RUN_MAX_MIN backstop with a shorter self-terminate time via
  // PresentMon's own --timed/terminate_after_timed, so no separate JS timer
  // is needed; clamped so it can only shorten a run, never lengthen it past
  // the normal hard cap.
  startRun(opts?: { dir?: string; onFinalize?: (summary: CaptureRunSummary | null) => void; maxDurationS?: number }): { ok: boolean; error?: string; base?: string } {
    this.ensureStarted();
    const name = this.activeProcessName();
    if (!name) return { ok: false, error: 'no active game to capture — focus a game first' };
    const exe = this.resolveExe();
    if (!exe) return { ok: false, error: 'no PresentMon executable found' };
    const dir = opts?.dir ?? CAPTURES_DIR;
    ensureCapturesDir(dir);
    const base = captureBaseName(name);
    const out = csvPath(base, dir);
    const major = detectMajorVersion(exe);
    const hardCapS = RUN_MAX_MIN * 60;
    const timed = String(opts?.maxDurationS ? Math.max(1, Math.min(Math.round(opts.maxDurationS), hardCapS)) : hardCapS);
    // Dedicated capture process — distinct ETW session, self-terminates on the
    // game exiting or after the --timed cap, writing a CapFrameX-readable CSV.
    const args = major >= 2
      ? ['--v1_metrics', '--process_name', name, '--output_file', out, '--session_name', 'PcControlWebCapture', '--stop_existing_session', '--terminate_on_proc_exit', '--timed', timed, '--terminate_after_timed']
      : ['-process_name', name, '-output_file', out, '-no_top', '-session_name', 'PcControlWebCapture', '-stop_existing_session', '-terminate_on_proc_exit', '-timed', timed, '-terminate_after_timed'];
    stopEtwSession('PcControlWebCapture'); // clear any stale capture session first
    let child: ChildProcess;
    try { child = spawn(exe, args, { windowsHide: true }); }
    catch { return { ok: false, error: 'failed to start capture process' }; }
    const now = Date.now();
    const run: RunState = { key: name.toLowerCase(), displayName: name, base, dir, startWall: now, startedAt: now, child, lastFrameT: this.maxT, ended: false, summary: null, onFinalize: opts?.onFinalize };
    this.run = run;
    captureSensorSampler.start(base, dir); // system-state timeline alongside the frame CSV, see capture-sensors.ts
    const onExit = () => { if (this.run === run) this.doFinalize(run.reason ?? 'process exited / time limit'); };
    child.on('exit', onExit);
    child.on('error', onExit);
    return { ok: true, base };
  }

  stopRun(): void { this.endRun('stopped'); }
  clearRun(): void { this.run = null; }

  private endRun(reason: string): void {
    const r = this.run;
    if (!r || r.ended || r.reason) return; // already stopping / ended
    r.reason = reason;
    if (r.child) { try { r.child.kill(); } catch { /* already gone */ } } // onExit → doFinalize
    else this.doFinalize(reason);
  }

  // Summarise the CSV the dedicated process wrote, persist a sidecar, prune old runs.
  private doFinalize(reason: string): void {
    const r = this.run;
    if (!r || r.ended) return;
    r.ended = true;
    r.child = null;
    captureSensorSampler.stop();
    r.summary = finalizeCapture(r.base, r.displayName, r.startedAt, reason, getAppConfig().hitchThreshold ?? 2, r.dir);
    r.onFinalize?.(r.summary);
  }

  runStatus(): CaptureRunStatus {
    this.lastRequestMs = Date.now();
    const r = this.run;
    if (!r) return { active: false };
    if (r.ended) return { active: false, ended: true, summary: r.summary };
    return { active: true, process: r.displayName, elapsedS: Math.round((Date.now() - r.startWall) / 1000) };
  }

  // Raw diagnostic — what PresentMon is actually emitting (for debugging).
  debug(): Record<string, unknown> {
    return {
      exe: this.resolvedExe,
      args: this.lastArgs,
      childAlive: this.child !== null,
      headerParsed: this.headerParsed,
      available: this.available(),
      lastDataMsAgo: this.lastDataMs ? Date.now() - this.lastDataMs : null,
      procCount: this.byProc.size,
      stdoutSample: this.stdoutSample.slice(0, 600),
      stderr: this.lastStderr.slice(0, 600),
    };
  }

  // Deterministic one-shot diagnostic: spawns the resolved exe with the exact
  // args the real streaming capture uses, and waits for either the first
  // parsed CSV header, a process exit, or a timeout — whichever comes first.
  // Unlike debug() (a snapshot of the persistent singleton's current state,
  // which can read as stale/misleading if the last spawn attempt is still
  // inside its RESTART_MS backoff window, or hasn't had its 'exit' event fire
  // yet), this always reflects a fresh, real attempt and reports exactly why
  // it failed — exit code/signal for a fast crash, or "still no header after
  // Ns" for a process that stays alive but never produces parseable output
  // (e.g. a CLI-incompatible PresentMon build).
  //
  // Every option beyond `seconds`/`processName` exists purely to investigate
  // newer PresentMon builds without needing a fresh package+reinstall cycle
  // per hypothesis — see docs/plans (PresentMon 2.5.1 investigation): whether
  // v2 metrics behave differently, whether a bigger ETW circular buffer or
  // trimming which event types get tracked avoids event-loss-induced total
  // capture failure, and whether writing straight to a file via --output_file
  // (PresentMon's own arg, bypassing our stdout pipe entirely) changes
  // anything — it shouldn't, since event correlation happens before either
  // output path, but it's cheap to confirm empirically rather than assume.
  diagnosticProbe(opts: {
    seconds?: number;
    processName?: string;
    metricsVersion?: 'v1' | 'v2';
    circularBufferSize?: number;
    outputMode?: 'stdout' | 'file';
    noTrackGpu?: boolean;
    noTrackDisplay?: boolean;
    noTrackInput?: boolean;
  } = {}): Promise<Record<string, unknown>> {
    const {
      seconds = 3, processName, metricsVersion = 'v1', circularBufferSize,
      outputMode = 'stdout', noTrackGpu, noTrackDisplay, noTrackInput,
    } = opts;
    return new Promise((resolvePromise) => {
      const exe = this.resolveExe();
      if (!exe) { resolvePromise({ ok: false, detail: 'no PresentMon executable found — set a path' }); return; }
      const major = detectMajorVersion(exe);
      const DIAG_SESSION = 'PcControlWebDiag';
      const dash = major >= 2 ? '--' : '-';
      const fileOut = outputMode === 'file' ? path.join(os.tmpdir(), `handymon-diag-${Date.now()}.csv`) : null;

      const args: string[] = major >= 2
        ? [`${dash}${metricsVersion}_metrics`, `${dash}stop_existing_session`, `${dash}session_name`, DIAG_SESSION]
        : [`${dash}captureall`, `${dash}no_top`, `${dash}stop_existing_session`, `${dash}session_name`, DIAG_SESSION];
      if (fileOut) args.push(`${dash}output_file`, fileOut); else args.push(`${dash}output_stdout`);
      if (processName) args.push(`${dash}process_name`, processName);
      if (circularBufferSize) args.push(`${dash}set_circular_buffer_size`, String(circularBufferSize));
      if (noTrackGpu) args.push(`${dash}no_track_gpu`);
      if (noTrackDisplay) args.push(`${dash}no_track_display`);
      if (noTrackInput) args.push(`${dash}no_track_input`);

      stopEtwSession(DIAG_SESSION);

      let stdout = '';
      let stderr = '';
      let headerParsed = false;
      let flipMeteringSupported = false;
      let exitCode: number | null = null;
      let exitSignal: string | null = null;
      let settled = false;
      let child: ChildProcess;

      const finish = (extra: Record<string, unknown> = {}) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { child?.kill(); } catch { /* already gone */ }
        // In file mode, nothing streams through stdout to inspect line-by-line
        // as it's written — read back whatever landed on disk once we're done.
        let fileContents: string | null = null;
        if (fileOut) {
          try { fileContents = readFileSync(fileOut, 'utf8'); } catch { /* not written / already gone */ }
          try { unlinkSync(fileOut); } catch { /* best-effort cleanup */ }
          if (fileContents && !headerParsed) {
            headerParsed = /application/i.test(fileContents) && /msbetweenpresents/i.test(fileContents);
            flipMeteringSupported = /msbetweendisplaychange/i.test(fileContents);
          }
        }
        const lostEventsMatch = stderr.match(/(\d+)\s+ETW events were lost/i);
        resolvePromise({
          ok: headerParsed,
          exe,
          args,
          headerParsed,
          // Whether this build's CSV header reports msBetweenDisplayChange —
          // the flip-metering column NVIDIA's DLSS4 PresentMon fork adds
          // (see variantRank()'s "-dlss" filename check above, which this
          // corroborates directly against actual output rather than guessing
          // from the filename alone). Absent on a plain build; present frame
          // pacing still reports, just via raw Present() timing instead.
          flipMeteringSupported,
          lostEvents: lostEventsMatch ? Number(lostEventsMatch[1]) : null,
          exitCode,
          exitSignal,
          stdoutSample: fileOut ? (fileContents?.slice(0, 800) ?? null) : stdout.slice(0, 800),
          stderr: stderr.slice(0, 800),
          ...extra,
        });
      };

      const timer = setTimeout(() => finish({ detail: `no header after ${seconds}s — process still running but not producing parseable output` }), seconds * 1000);

      try { child = spawn(exe, args, { windowsHide: true }); }
      catch (e) { finish({ detail: `failed to spawn: ${e}` }); return; }

      child.stdout!.setEncoding('utf8');
      child.stdout!.on('data', (d: string) => {
        stdout += d;
        // Check the accumulated buffer, not just this one chunk — a piped
        // stream has no guarantee the header line arrives in a single read;
        // testing only `d` silently missed a header split across two chunks
        // (a real, pre-existing bug — this path never actually confirmed a
        // working capture, even for builds proven to work via the real
        // persistent engine's own line-buffered parser).
        if (!fileOut && !headerParsed && /application/i.test(stdout) && /msbetweenpresents/i.test(stdout)) {
          headerParsed = true;
          flipMeteringSupported = /msbetweendisplaychange/i.test(stdout);
          finish({ detail: `header parsed — capture would work${flipMeteringSupported ? ' (DLSS4 flip-metering supported)' : ''}` });
        }
      });
      child.stderr!.on('data', (d: Buffer) => { stderr += d.toString(); });
      child.on('exit', (code, signal) => {
        exitCode = code;
        exitSignal = signal;
        finish({ detail: headerParsed ? undefined : `process exited (code ${code ?? 'null'}${signal ? `, signal ${signal}` : ''}) before producing a header` });
      });
      child.on('error', (e) => finish({ detail: `spawn error: ${e}` }));
    });
  }

  // Diagnostic snapshot for the settings "test" button.
  probe(): { ok: boolean; detail: string } {
    const exe = this.resolveExe();
    if (!exe) return { ok: false, detail: 'no PresentMon executable found — set a path' };
    this.ensureStarted();
    const name = this.resolvedExe ?? exe;                       // full path (shows what auto-detect picked)
    if (!this.available()) {
      return { ok: false, detail: `found ${name} — starting capture, retry in a moment` };
    }
    const flipMetering = this.cols['msbetweendisplaychange'] !== undefined ? ' · DLSS4 flip-metering supported' : '';
    const arr = this.activeProcess();
    if (!arr) return { ok: true, detail: `${name} · capturing (no active game — desktop idle)${flipMetering}` };
    const fr = this.getFramerate();
    return { ok: true, detail: `${name} · ${arr[0].app} @ ${fr.framerateFps ?? '—'} fps${flipMetering}` };
  }

  // One-off diagnostic: a short --track_frame_type capture (separate ETW
  // session from the streaming one) to see whether real FrameType data comes
  // back at all — coverage depends on game/driver instrumentation, so this is
  // how we find out rather than guessing. Not used by the regular FPS path.
  probeFrameType(seconds: number): Promise<{ ok: boolean; detail: string; header?: string; rows?: string[] }> {
    return new Promise((resolvePromise) => {
      const exe = this.resolveExe();
      if (!exe) { resolvePromise({ ok: false, detail: 'no PresentMon executable found' }); return; }
      const PROBE_SESSION = 'PcControlWebFrameTypeProbe';
      stopEtwSession(PROBE_SESSION);
      const args = ['--output_stdout', '--track_frame_type', '--track_app_timing', '--session_name', PROBE_SESSION, '--stop_existing_session', '--timed', String(seconds), '--terminate_after_timed'];
      let child: ChildProcess;
      try { child = spawn(exe, args, { windowsHide: true }); }
      catch (e) { resolvePromise({ ok: false, detail: `failed to spawn: ${e}` }); return; }
      let out = '';
      let err = '';
      child.stdout!.setEncoding('utf8');
      child.stdout!.on('data', (d: string) => { out += d; });
      child.stderr!.on('data', (d: Buffer) => { err += d.toString(); });
      const killTimer = setTimeout(() => { try { child.kill(); } catch { /* already gone */ } }, (seconds + 5) * 1000);
      child.on('exit', () => {
        clearTimeout(killTimer);
        const lines = out.split(/\r?\n/).filter(Boolean);
        if (!lines.length) { resolvePromise({ ok: false, detail: err.trim().slice(0, 400) || 'no output captured' }); return; }
        resolvePromise({ ok: true, detail: `${lines.length - 1} rows captured`, header: lines[0], rows: lines.slice(1, 8) });
      });
      child.on('error', (e) => { clearTimeout(killTimer); resolvePromise({ ok: false, detail: String(e) }); });
    });
  }
}

// Module-level singleton — persists across requests in the running server.
const capture = new PresentMonCapture();

export function ensurePresentMon(): void { capture.ensureStarted(); }
export function presentMonAvailable(): boolean { return capture.available(); }
export function getPresentMonFramerate(): GpuFramerate { return capture.getFramerate(); }
export function getPresentMonProcess(): string | null { return capture.activeProcessName(); }
export function probePresentMon(): { ok: boolean; detail: string } { return capture.probe(); }
export function debugPresentMon(): Record<string, unknown> { capture.ensureStarted(); return capture.debug(); }
export function diagnosticProbePresentMon(opts?: Parameters<PresentMonCapture['diagnosticProbe']>[0]): Promise<Record<string, unknown>> { return capture.diagnosticProbe(opts); }
export function probeFrameType(seconds = 5) { return capture.probeFrameType(seconds); }
export function resetPresentMon(): void { capture.reset(); }
export function restartPresentMon(): void { capture.forceRestart(); }
export function startCaptureRun(opts?: { dir?: string; onFinalize?: (summary: CaptureRunSummary | null) => void; maxDurationS?: number }): { ok: boolean; error?: string; base?: string } { return capture.startRun(opts); }
export function stopCaptureRun(): void { capture.stopRun(); }
export function clearCaptureRun(): void { capture.clearRun(); }
export function captureRunStatus(): CaptureRunStatus { return capture.runStatus(); }
export function pinPresentMonProcess(key: string, displayName: string, pid: number | null): void { capture.pinProcess(key, displayName, pid); }
export function unpinPresentMonProcess(): void { capture.unpinProcess(); }
export function getPinnedPresentMonProcess(): { displayName: string } | null { return capture.getPinnedProcess(); }
export function listPresentMonCandidates(): PresentMonCandidate[] { return capture.listCandidateProcesses(); }
