import { spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'fs';
import path from 'path';
import type { CaptureFileInfo, CaptureRunSummary, CaptureSeriesPoint, CaptureSensorSample } from '@/types/perf';
import { CAPTURES_DIR } from './dirs';
import { readCaptureSensors, deleteCaptureSensors } from './capture-sensors';

export { CAPTURES_DIR };
const KEEP_N = 30;           // retention: keep this many most-recent runs
const MAX_SERIES_POINTS = 800; // downsample cap for the view chart
const CAPFRAMEX_EXE = 'C:\\Program Files (x86)\\CapFrameX\\CapFrameX.exe';

function ensureDir(dir: string = CAPTURES_DIR) {
  try { mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
}

// Filename base: 20260724-153012_SB-Win64-Shipping
export function captureBaseName(processName: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const safe = processName.replace(/\.exe$/i, '').replace(/[^\w.-]/g, '_').slice(0, 40);
  return `${ts}_${safe}`;
}

// `dir` defaults to the flat CAPTURES_DIR (regular single-shot captures) but
// every one of these also accepts a comparison's own subfolder — see
// comparisons.ts, which reuses this entire file's logic unmodified for
// Variant files rather than duplicating it.
export function csvPath(base: string, dir: string = CAPTURES_DIR): string { return path.join(dir, `${base}.csv`); }
export function sidecarPath(base: string, dir: string = CAPTURES_DIR): string { return path.join(dir, `${base}.json`); }

// Only allow a plain "<base>.csv" filename that exists in `dir`.
function resolveCsv(file: string, dir: string = CAPTURES_DIR): string | null {
  if (path.basename(file) !== file || !/^[\w.-]+\.csv$/.test(file)) return null;
  const full = path.join(dir, file);
  return existsSync(full) ? full : null;
}

interface ParsedCsv { frametimes: number[]; times: number[]; }

function parseCsv(full: string): ParsedCsv {
  const text = readFileSync(full, 'utf8');
  const lines = text.split(/\r?\n/);
  const frametimes: number[] = [];
  const times: number[] = [];
  let ftCol = -1, ftDisplayCol = -1, tCol = -1;
  let headerDone = false;
  for (const line of lines) {
    if (!line) continue;
    const f = line.split(',');
    if (!headerDone) {
      if (/msbetweenpresents/i.test(line)) {
        f.forEach((name, i) => {
          const n = name.trim().toLowerCase();
          if (n === 'msbetweenpresents') ftCol = i;
          if (n === 'msbetweendisplaychange') ftDisplayCol = i;
          if (n === 'timeinseconds') tCol = i;
        });
        headerDone = true;
      }
      continue;
    }
    // Prefer msBetweenDisplayChange (actual on-screen flip cadence, accurate
    // for frame-gen on NVIDIA's flip-metering builds) — falls back to
    // msBetweenPresents on any build that doesn't report it.
    const ft = parseFloat(f[ftDisplayCol >= 0 ? ftDisplayCol : ftCol]);
    const t = tCol >= 0 ? parseFloat(f[tCol]) : NaN;
    if (isFinite(ft) && ft >= 0.5 && ft <= 2000) { frametimes.push(ft); times.push(isFinite(t) ? t : frametimes.length); }
  }
  return { frametimes, times };
}

const clampFps = (v: number | null) => (v !== null && isFinite(v) && v > 0 && v <= 1000) ? Math.round(v) : null;

// Indices into `fts` flagged as hitches — a rolling 20-frame local average,
// hitch = a frame that's both a multiplier over that average AND at least
// 4ms over it (the flat-4ms floor is what keeps a already-janky low-FPS
// session from flagging nearly every frame just for being noisy). Shared by
// summarize() (just needs the count) and finalizeCapture() (needs the
// actual positions, to persist alongside the summary for the view dialog's
// hitch markers/prev-next nav) so both always agree with each other.
function detectHitchIndices(fts: number[], hitchThreshold: number): number[] {
  const threshold = Math.max(1.2, hitchThreshold);
  const indices: number[] = [];
  let rollSum = 0; const roll: number[] = [];
  fts.forEach((f, i) => {
    if (roll.length >= 20) { const la = rollSum / roll.length; if (f > la * threshold && f > la + 4) indices.push(i); }
    roll.push(f); rollSum += f; if (roll.length > 20) rollSum -= roll.shift()!;
  });
  return indices;
}

// Shared by summarize() (whole capture) and computeWindowedSummary() (a
// user-picked region slice, see the Phase 2 region selector) so both use
// identical stat math and only differ in which frames they're handed.
function summarizeFrames(fts: number[], times: number[], processName: string, endReason: string, hitchThreshold: number): CaptureRunSummary {
  if (fts.length < 2) {
    return { process: processName, durationS: 0, frames: fts.length, avgFps: null, minFps: null, maxFps: null, low1pct: null, low01pct: null, hitches: null, endReason };
  }
  const span = times[times.length - 1] - times[0];
  const sorted = [...fts].sort((a, b) => a - b);
  const pctFt = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1))];
  return {
    process: processName,
    durationS: span > 0 ? Math.round(span * 10) / 10 : 0,
    frames: fts.length,
    avgFps: clampFps(span > 0 ? fts.length / span : null),
    minFps: clampFps(1000 / sorted[sorted.length - 1]),
    // MAX from the fastest realistic frame (>=1ms) — a single sub-ms artifact
    // (back-to-back present) would otherwise read >1000fps and clamp to null.
    maxFps: clampFps(1000 / (sorted.find(f => f >= 1) ?? sorted[0])),
    low1pct: clampFps(1000 / pctFt(99)),
    low01pct: clampFps(1000 / pctFt(99.9)),
    hitches: detectHitchIndices(fts, hitchThreshold).length,
    endReason,
  };
}

export function summarize(csvFull: string, processName: string, endReason: string, hitchThreshold: number): CaptureRunSummary {
  const { frametimes: fts, times } = parseCsv(csvFull);
  return summarizeFrames(fts, times, processName, endReason, hitchThreshold);
}

// Recomputes stats from only the frames whose time (seconds since capture
// start) falls within [start, end] — the Phase 2 region selector, for
// comparing a representative slice when variants ran for different lengths.
export function computeWindowedSummary(file: string, dir: string, start: number, end: number, hitchThreshold: number): CaptureRunSummary | null {
  const full = resolveCsv(file, dir);
  if (!full) return null;
  const { frametimes: allFts, times: allTimes } = parseCsv(full);
  if (allTimes.length === 0) return null;
  const t0 = allTimes[0];
  const fts: number[] = [];
  const times: number[] = [];
  for (let i = 0; i < allTimes.length; i++) {
    const rel = allTimes[i] - t0;
    if (rel >= start && rel <= end) { fts.push(allFts[i]); times.push(allTimes[i]); }
  }
  // No `process`/`endReason` context here — windowed summaries are always
  // read alongside the variant's own full summary, which already has both.
  return summarizeFrames(fts, times, '', 'region', hitchThreshold);
}

// Called when a run ends: summarise the CSV, write a sidecar, prune old runs.
// `dir` defaults to the flat CAPTURES_DIR; a comparison Variant passes its
// own comparisons/<id>/ folder instead, and skips prune() entirely — that
// retention logic is specific to the flat top-level capture list, and a
// comparison's own folder has nothing in it to prune against.
export function finalizeCapture(base: string, processName: string, startedAt: number, endReason: string, hitchThreshold: number, dir: string = CAPTURES_DIR): CaptureRunSummary | null {
  const full = csvPath(base, dir);
  if (!existsSync(full)) return null;
  const summary = summarize(full, processName, endReason, hitchThreshold);
  // Hitch positions (seconds since capture start, same clock as
  // CaptureSeriesPoint.t) — computed once here, at the same moment and with
  // the same threshold as the summary's own hitch count, rather than
  // re-derived later at view time (which could disagree if the hitch
  // threshold setting changes between capturing and viewing).
  let hitchTimes: number[] = [];
  try {
    const { frametimes: fts, times } = parseCsv(full);
    if (fts.length > 1) {
      const t0 = times[0];
      hitchTimes = detectHitchIndices(fts, hitchThreshold).map(i => Math.round((times[i] - t0) * 100) / 100);
    }
  } catch { /* best-effort */ }
  try { writeFileSync(sidecarPath(base, dir), JSON.stringify({ process: processName, startedAt, summary, hitchTimes })); } catch { /* ignore */ }
  if (dir === CAPTURES_DIR) prune();
  return summary;
}

export function listCaptures(): CaptureFileInfo[] {
  ensureDir();
  const out: CaptureFileInfo[] = [];
  for (const name of readdirSync(CAPTURES_DIR)) {
    if (!name.endsWith('.json')) continue;
    const base = name.slice(0, -5);
    if (!existsSync(csvPath(base))) continue;
    try {
      const meta = JSON.parse(readFileSync(path.join(CAPTURES_DIR, name), 'utf8'));
      out.push({ file: `${base}.csv`, process: meta.process, startedAt: meta.startedAt, summary: meta.summary });
    } catch { /* skip corrupt sidecar */ }
  }
  return out.sort((a, b) => b.startedAt - a.startedAt);
}

export function readCaptureData(file: string, dir: string = CAPTURES_DIR): { summary: CaptureRunSummary | null; series: CaptureSeriesPoint[]; hitchTimes: number[]; sensors: CaptureSensorSample[] } | null {
  const full = resolveCsv(file, dir);
  if (!full) return null;
  const { frametimes, times } = parseCsv(full);
  const base = file.slice(0, -4);
  let summary: CaptureRunSummary | null = null;
  let hitchTimes: number[] = [];
  try {
    const sidecar = JSON.parse(readFileSync(sidecarPath(base, dir), 'utf8'));
    summary = sidecar.summary ?? null;
    // Older captures (made before this field existed) just get no markers.
    hitchTimes = Array.isArray(sidecar.hitchTimes) ? sidecar.hitchTimes : [];
  } catch { /* none */ }
  const t0 = times[0] ?? 0;
  const step = Math.max(1, Math.ceil(frametimes.length / MAX_SERIES_POINTS));
  const series: CaptureSeriesPoint[] = [];
  for (let i = 0; i < frametimes.length; i += step) {
    series.push({ t: Math.round((times[i] - t0) * 100) / 100, ft: Math.round(frametimes[i] * 100) / 100 });
  }
  return { summary, series, hitchTimes, sensors: readCaptureSensors(base, dir) };
}

export function deleteCapture(file: string, dir: string = CAPTURES_DIR): boolean {
  const full = resolveCsv(file, dir);
  if (!full) return false;
  const base = file.slice(0, -4);
  try { rmSync(full); } catch { /* ignore */ }
  try { rmSync(sidecarPath(base, dir)); } catch { /* ignore */ }
  deleteCaptureSensors(base, dir);
  return true;
}

// Keep the KEEP_N newest runs (by CSV mtime); delete the rest + their sidecars.
function prune() {
  try {
    const csvs = readdirSync(CAPTURES_DIR).filter(n => n.endsWith('.csv'))
      .map(n => ({ n, m: statSync(path.join(CAPTURES_DIR, n)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    for (const { n } of csvs.slice(KEEP_N)) {
      const base = n.slice(0, -4);
      try { rmSync(path.join(CAPTURES_DIR, n)); } catch { /* ignore */ }
      try { rmSync(sidecarPath(base)); } catch { /* ignore */ }
      deleteCaptureSensors(base);
    }
  } catch { /* ignore */ }
}

export function capFrameXAvailable(): boolean { return existsSync(CAPFRAMEX_EXE); }

// Best-effort: launch CapFrameX (with the CSV path as an arg — harmless if it
// ignores it). CapFrameX is a desktop app on the host; this is a host action.
export function openWithCapFrameX(file: string): { ok: boolean; error?: string } {
  const full = resolveCsv(file);
  if (!full) return { ok: false, error: 'capture not found' };
  // CapFrameX doesn't reliably open a file passed on the command line, so also
  // reveal the CSV in Explorer (selected) — the user can drag/import it.
  try { spawn('explorer.exe', [`/select,${full}`], { detached: true, stdio: 'ignore' }).unref(); } catch { /* ignore */ }
  if (capFrameXAvailable()) {
    try { spawn(CAPFRAMEX_EXE, [full], { detached: true, stdio: 'ignore' }).unref(); } catch { /* ignore */ }
  }
  return { ok: true };
}

export { ensureDir as ensureCapturesDir };
