import { existsSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'fs';
import path from 'path';
import type { CaptureSensorSample } from '@/types/perf';
import { CAPTURES_DIR } from './dirs';
import { fetchLhmStats } from './lhm';
import { collectCaptureIoSample } from './perf';

// A system-state timeline that runs alongside a PresentMon CAPTURE run —
// answers "what was the CPU/GPU/disk/network doing" for a hitch found later
// in the frametime chart. Server-side and on its own timer (not tied to the
// browser being open) so it survives a backgrounded/closed tab the same way
// the capture itself does. Written as JSONL (one JSON object per line) —
// row count here is small (roughly one per second of capture, not one per
// frame like the CSV), so CSV's compactness doesn't matter, and JSONL
// tolerates the schema growing a field later (like CPU clocks did) without
// needing every historical file to agree on column count. Same append-once-
// flushed-per-line crash safety as CSV: if the process dies mid-tick, every
// line already written stays valid; only an in-flight line could be cut short.
const SAMPLE_INTERVAL_MS = 1000;

// `dir` defaults to the flat CAPTURES_DIR (regular single-shot captures) but
// also accepts a comparison Variant's own subfolder — see comparisons.ts.
function sensorsPath(base: string, dir: string = CAPTURES_DIR): string {
  return path.join(dir, `${base}.sensors.jsonl`);
}

class CaptureSensorSampler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private base = '';
  private dir = CAPTURES_DIR;
  private startMs = 0;
  private busy = false;

  start(base: string, dir: string = CAPTURES_DIR): void {
    this.stop();
    this.base = base;
    this.dir = dir;
    this.startMs = Date.now();
    try { writeFileSync(sensorsPath(base, dir), ''); } catch { /* best-effort */ }
    this.timer = setInterval(() => { void this.tick(); }, SAMPLE_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.busy = false;
  }

  private async tick(): Promise<void> {
    // A slow LHM/PowerShell round-trip shouldn't cause overlapping ticks to
    // pile up — just skip this tick and try again next interval.
    if (this.busy) return;
    this.busy = true;
    const base = this.base;
    const dir = this.dir;
    try {
      const [lhm, io] = await Promise.all([
        fetchLhmStats().catch(() => null),
        collectCaptureIoSample().catch(() => null),
      ]);
      const sample: CaptureSensorSample = {
        t: Math.round((Date.now() - this.startMs) / 100) / 10,
        cpuPct: lhm?.cpu.overall ?? null,
        cpuTempC: lhm?.cpu.packageTempC ?? null,
        cpuClockMhz: lhm?.cpu.avgClockMhz ?? null,
        gpuPct: lhm?.gpu.utilization ?? null,
        gpuTempC: lhm?.gpu.tempC ?? null,
        gpuClockMhz: lhm?.gpu.coreClockMhz ?? null,
        vramMb: lhm?.gpu.dedicatedVramMb ?? null,
        ramUsedMb: io?.ramUsedMb ?? null,
        diskReadMbps: io?.diskReadMbps ?? null,
        diskWriteMbps: io?.diskWriteMbps ?? null,
        netRecvMbps: io?.netRecvMbps ?? null,
        netSentMbps: io?.netSentMbps ?? null,
      };
      // `base`/`dir` (not this.base/this.dir) — if start() was called again
      // for a new run while this tick was in flight, don't let a stale
      // sample land in the new run's file.
      if (base === this.base && dir === this.dir) appendFileSync(sensorsPath(base, dir), JSON.stringify(sample) + '\n');
    } catch { /* best-effort — one missed tick isn't worth surfacing */ }
    finally { this.busy = false; }
  }
}

export const captureSensorSampler = new CaptureSensorSampler();

export function readCaptureSensors(base: string, dir: string = CAPTURES_DIR): CaptureSensorSample[] {
  const full = sensorsPath(base, dir);
  if (!existsSync(full)) return [];
  const out: CaptureSensorSample[] = [];
  for (const line of readFileSync(full, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip a corrupt/partial trailing line */ }
  }
  return out;
}

export function deleteCaptureSensors(base: string, dir: string = CAPTURES_DIR): void {
  try { rmSync(sensorsPath(base, dir)); } catch { /* ignore */ }
}
