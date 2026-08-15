import { z } from 'zod';

// ── Sensor source ─────────────────────────────────────────────────────────────
// Hardware sensors (temp/power/clocks/VRAM) come from LibreHardwareMonitor;
// FPS/frametime come from PresentMon (ETW) — see src/utils/lhm.ts, presentmon.ts.
export type SensorSource = 'lhm';

// ── Perf snapshot ─────────────────────────────────────────────────────────────

export const PerfSnapshotSchema = z.object({
  timestamp: z.number(),
  cpu: z.object({
    overall: z.number(),
    cores: z.array(z.number()),
    packageTempC: z.number().nullable().optional(),
    packagePowerW: z.number().nullable().optional(),
    avgClockMhz: z.number().nullable().optional(),
    maxClockMhz: z.number().nullable().optional(),
  }),
  ram: z.object({
    usedMb: z.number(),
    totalMb: z.number(),
  }),
  gpu: z.object({
    utilization: z.number(),
    dedicatedVramMb: z.number(),
    totalVramMb: z.number(),
    tempC: z.number().nullable().optional(),
    powerW: z.number().nullable().optional(),
    coreClockMhz: z.number().nullable().optional(),
    memClockMhz: z.number().nullable().optional(),
    framerateFps:      z.number().nullable().optional(),
    framerateAvg:      z.number().nullable().optional(),
    framerate1pctLow:  z.number().nullable().optional(),
    framerate01pctLow: z.number().nullable().optional(),
    frameTimeMs:       z.number().nullable().optional(),
  }),
  // Hardware sensors (LHM) present this poll.
  sensorsAvailable: z.boolean(),
  // Afterburner framerate feed reachable this poll.
  fpsAvailable: z.boolean(),
});

export type PerfSnapshot = z.infer<typeof PerfSnapshotSchema>;

// ── Capture runs (PresentMon benchmark) ─────────────────────────────────────

export interface CaptureRunSummary {
  process: string;
  durationS: number;
  frames: number;
  avgFps: number | null;
  minFps: number | null;
  maxFps: number | null;
  low1pct: number | null;
  low01pct: number | null;
  hitches: number | null;
  endReason: string;
}

export interface CaptureRunStatus {
  active: boolean;
  ended?: boolean;
  process?: string;
  elapsedS?: number;
  frames?: number;
  summary?: CaptureRunSummary | null;
  error?: string;
}

export interface CaptureFileInfo {
  file: string;       // base filename (no path)
  process: string;
  startedAt: number;  // unix ms
  summary: CaptureRunSummary;
}

export interface CaptureSeriesPoint { t: number; ft: number; }

// One system-state sample taken during a CAPTURE run — sampled server-side
// on a timer independent of the frame CSV (see capture-sensors.ts), so a
// hitch can be matched against what CPU/GPU/disk/network were doing at
// roughly that moment. `t` uses the same "seconds since capture start"
// clock as CaptureSeriesPoint.t. Every field is nullable since a sample can
// land while LHM is unreachable (still records disk/net/ram) or vice versa.
export interface CaptureSensorSample {
  t: number;
  cpuPct: number | null;
  cpuTempC: number | null;
  cpuClockMhz: number | null;
  gpuPct: number | null;
  gpuTempC: number | null;
  gpuClockMhz: number | null;
  vramMb: number | null;
  ramUsedMb: number | null;
  diskReadMbps: number | null;
  diskWriteMbps: number | null;
  netRecvMbps: number | null;
  netSentMbps: number | null;
}

// ── Comparisons (a labeled group of Captures, "Variants", for A/B settings) ──
// See docs/plans/comparison-captures.md. A Variant is a completely normal
// Capture under the hood — same CSV/summary/sensors.jsonl as a standalone
// capture, just written into the comparison's own subfolder and labeled.

export interface ComparisonVariant {
  base: string;   // this variant's own <base>.csv/.json/.sensors.jsonl, same naming as a standalone capture
  label: string;  // e.g. "Quality Mode" — user-provided, defaults to "Variant N" if left blank
  order: number;
  summary: CaptureRunSummary | null; // filled in once this variant's capture finalizes
  // Phase 2 region selector (see docs/plans/comparison-captures.md): a
  // user-picked [regionStart, regionEnd] slice (seconds, same clock as
  // CaptureSeriesPoint.t) of this variant's own capture, for apples-to-
  // apples comparison when variants ran for different lengths of time.
  // Absent until the user actually drags a window — the viewer computes a
  // runtime-only [0, shortestVariantDuration] default rather than this being
  // eagerly persisted. windowedSummary is the same shape as `summary` but
  // computed only from frames inside the region, cached here so the table
  // doesn't need to recompute it on every load.
  regionStart?: number;
  regionEnd?: number;
  windowedSummary?: CaptureRunSummary | null;
}

export interface ComparisonManifest {
  id: string;        // e.g. 20260809-143000_dlss-quality-modes — also the folder name under comparisons/
  label: string;      // overall comparison label — defaults to the process name if left blank
  process: string;
  createdAt: number;  // unix ms
  variants: ComparisonVariant[];
}

export interface ComparisonListItem {
  id: string;
  label: string;
  process: string;
  createdAt: number;
  variantCount: number;
}

export interface ComparisonRunStatus {
  active: boolean;
  id?: string;
  state?: 'capturing' | 'paused';
  currentVariantLabel?: string;
  currentVariantElapsedS?: number;
  variantsCompleted?: number;
  // First variant's own label/duration, once it has finished — lets the
  // "next variant" prompt offer "match Quality Mode's duration (62s)".
  firstVariantLabel?: string;
  firstVariantDurationS?: number;
  error?: string;
}

// ── Generic LHM sensor lists (Temps / Fans / Power tabs) ─────────────────────

export interface LhmReading {
  hardware: string;    // display name, e.g. "AMD Ryzen 9 9950X3D"
  hardwareId: string;  // e.g. "/amdcpu/0"
  name: string;        // sensor label, e.g. "Core (Tctl/Tdie)"
  value: number;
}

export interface LhmSensorGroups {
  temperatures: LhmReading[]; // °C
  powers: LhmReading[];       // W
  fans: LhmReading[];         // RPM
  controls: LhmReading[];     // % (fan control)
}

// ── Advanced snapshot (disk, network, top processes) ─────────────────────────

export interface PerfProcess {
  name: string;
  cpuPercent: number;
  ramMb: number;
}

export interface PerfAdvancedSnapshot {
  timestamp: number;
  disk: { readMbps: number; writeMbps: number };
  network: { recvMbps: number; sentMbps: number };
  pagefile: { usedMb: number; totalMb: number } | null;
  topProcesses: PerfProcess[];
}
