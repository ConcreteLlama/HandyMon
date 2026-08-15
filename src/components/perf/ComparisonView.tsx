'use client';

import { useState, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TableRowsIcon from '@mui/icons-material/TableRows';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CropIcon from '@mui/icons-material/Crop';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { fetchComparisonData, setComparisonVariantRegion, type ComparisonData } from '@/hooks/perf/useComparisons';
import type { CaptureSensorSample, CaptureSeriesPoint } from '@/types/perf';
import { ModalShell } from '@/components/ui/ModalShell';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { helpProps } from '@/components/help/HelpModeContext';
import { chartSx, AXIS_LABEL_COLOR } from './cards/shared';

const HITCH_COLOR = '#fb923c';
// Distinct from the app's single-capture palette (frametime red, hitch orange, 1%low pink, 0.1%low purple).
const VARIANT_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#06b6d4', '#eab308', '#f472b6'];

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function avgOf(samples: CaptureSensorSample[], key: 'cpuPct' | 'gpuPct'): number | null {
  const vals = samples.map(s => s[key]).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// Nearest sample to a target t — same "nearest, not interpolated" approach
// as the single-capture hitch snapshot lookup.
function nearestSample(sensors: CaptureSensorSample[], t: number): CaptureSensorSample | null {
  if (sensors.length === 0) return null;
  let best = sensors[0], bestDiff = Math.abs(sensors[0].t - t);
  for (const s of sensors) {
    const diff = Math.abs(s.t - t);
    if (diff < bestDiff) { best = s; bestDiff = diff; }
  }
  return best;
}

// Index of the best value in a column (undefined higherIsBetter = no
// highlight at all, e.g. DURATION). Only highlights when 2+ variants have
// data for that column — a lone value isn't "best" of anything.
function bestIndex(values: (number | null)[], higherIsBetter: boolean): number | null {
  const withData = values.filter(v => v != null);
  if (withData.length < 2) return null;
  let best: number | null = null;
  values.forEach((v, i) => {
    if (v == null) return;
    if (best === null || (higherIsBetter ? v > values[best]! : v < values[best]!)) best = i;
  });
  return best;
}

// Prefers each variant's windowed (region-selected) duration when set — once
// every variant has a region, effective durations converge on the shortest
// variant's length and this naturally stops flagging a mismatch, no special
//-casing needed.
function effectiveDurationS(v: ComparisonData['variants'][number]): number | null {
  return v.windowedSummary?.durationS ?? v.summary?.durationS ?? null;
}

function durationMismatch(data: ComparisonData): boolean {
  const durations = data.variants.map(effectiveDurationS).filter((d): d is number => d != null);
  if (durations.length < 2) return false;
  const max = Math.max(...durations), min = Math.min(...durations);
  return max > 0 && (max - min) / max > 0.3;
}

function shortestDurationS(data: ComparisonData): number | null {
  const durations = data.variants.map(v => v.summary?.durationS).filter((d): d is number => d != null && d > 0);
  return durations.length ? Math.min(...durations) : null;
}

// Resamples a variant's frametime series onto a shared set of x positions
// (nearest-sample, not interpolated) so multiple variants of different
// lengths/sample-counts can share one xAxis on the overlaid chart. A gap
// (null) beyond a shorter variant's own duration keeps its line from
// flat-lining out past where it actually ended.
function resample(series: CaptureSeriesPoint[], xs: number[]): (number | null)[] {
  if (series.length === 0) return xs.map(() => null);
  const lastT = series[series.length - 1].t;
  return xs.map(x => {
    if (x > lastT + 0.5) return null;
    let best = series[0], bestDiff = Math.abs(series[0].t - x);
    for (const p of series) {
      const diff = Math.abs(p.t - x);
      if (diff < bestDiff) { best = p; bestDiff = diff; }
    }
    return best.ft;
  });
}

const thSx = {
  fontFamily: 'var(--font-display)', fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.06em',
  color: 'var(--text-dim)', textAlign: 'right', px: 1, py: 0.6, whiteSpace: 'nowrap',
} as const;
const tdSx = {
  fontFamily: 'var(--font-mono)', fontSize: '0.78rem', textAlign: 'right', px: 1, py: 0.7,
  borderTop: '1px solid var(--border)', whiteSpace: 'nowrap',
} as const;

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', px: 1.5, py: 0.75, minWidth: 52 }}>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</Box>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)', mt: 0.3 }}>{label}</Box>
    </Box>
  );
}

function SensorTile({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '7px', px: 1, py: 0.7 }}>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</Box>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)', mt: 0.2 }}>{label}</Box>
    </Box>
  );
}

// ── One variant's own detail view — same shape as a standalone capture's
// (stat row, frametime chart with hitch markers, hitch nav + sensor
// snapshot), just reading data already fetched for the whole comparison
// instead of a second round trip. ───────────────────────────────────────────

function VariantDetail({ data, color, onClose }: { data: NonNullable<ComparisonData['variantData'][number]> & { label: string; process: string }; color: string; onClose: () => void }) {
  const s = data.summary;
  const series = data.series;
  const hitchTimes = data.hitchTimes;
  const sensors = data.sensors;

  const [selHitch, setSelHitch] = useState<number | null>(null);
  function stepHitch(delta: number) {
    if (hitchTimes.length === 0) return;
    setSelHitch(prev => prev === null ? (delta > 0 ? 0 : hitchTimes.length - 1) : Math.min(hitchTimes.length - 1, Math.max(0, prev + delta)));
  }
  const selectedT = selHitch !== null ? hitchTimes[selHitch] : null;
  const snapshot = selectedT !== null ? nearestSample(sensors, selectedT) : null;

  return (
    <ModalShell onClose={onClose} maxWidth={520}>
      <DialogHeader
        title={data.label}
        onClose={onClose}
        startAdornment={<Box sx={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />}
      />
      {s && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Stat label="AVG" value={`${s.avgFps ?? '—'}`} color="#f59e0b" />
          <Stat label="1% LOW" value={`${s.low1pct ?? '—'}`} color="#ec4899" />
          <Stat label="0.1% LOW" value={`${s.low01pct ?? '—'}`} color="#a855f7" />
          <Stat label="MIN" value={`${s.minFps ?? '—'}`} color="#10b981" />
          <Stat label="MAX" value={`${s.maxFps ?? '—'}`} color="var(--text-dim)" />
          <Stat label="HITCHES" value={`${s.hitches ?? '—'}`} color={HITCH_COLOR} />
        </Box>
      )}
      {series.length > 1 ? (
        <LineChart
          height={190}
          skipAnimation
          xAxis={[{ data: series.map(p => p.t), scaleType: 'linear', tickNumber: 5, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${Math.round(v)}s` }]}
          yAxis={[{ min: 0, max: Math.max(5, ...series.map(p => p.ft)) * 1.15, width: 28, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
          series={[{ data: series.map(p => p.ft), color, area: true, showMark: false, label: 'ms' }]}
          margin={{ top: 10, bottom: 28, left: 4, right: 12 }}
          sx={chartSx}
        >
          {hitchTimes.map((t, i) => (
            <ChartsReferenceLine
              key={i}
              x={t}
              lineStyle={i === selHitch
                ? { stroke: HITCH_COLOR, strokeWidth: 2 }
                : { stroke: HITCH_COLOR, strokeWidth: 1, strokeOpacity: 0.35, strokeDasharray: '3 3' }}
            />
          ))}
        </LineChart>
      ) : (
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 2, textAlign: 'center' }}>no frame data</Box>
      )}

      {hitchTimes.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
            {selHitch !== null ? `HITCH ${selHitch + 1} / ${hitchTimes.length} — at ${hitchTimes[selHitch]}s` : `${hitchTimes.length} HITCH${hitchTimes.length !== 1 ? 'ES' : ''}`}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Box onClick={() => stepHitch(-1)} sx={{ display: 'flex', p: 0.4, borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', '&:hover': { borderColor: HITCH_COLOR, color: HITCH_COLOR } }}>
              <ChevronLeftIcon sx={{ fontSize: 16 }} />
            </Box>
            <Box onClick={() => stepHitch(1)} sx={{ display: 'flex', p: 0.4, borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', '&:hover': { borderColor: HITCH_COLOR, color: HITCH_COLOR } }}>
              <ChevronRightIcon sx={{ fontSize: 16 }} />
            </Box>
          </Box>
        </Box>
      )}

      {selHitch !== null && snapshot && (
        <Box sx={{ borderRadius: '10px', border: '1px dashed var(--border)', p: 1 }}>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.56rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', mb: 0.6 }}>
            SYSTEM AT {hitchTimes[selHitch]}s
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 0.5 }}>
            <SensorTile label="CPU" value={`${snapshot.cpuPct ?? '—'}% · ${snapshot.cpuTempC ?? '—'}°C`} />
            <SensorTile label="GPU" value={`${snapshot.gpuPct ?? '—'}% · ${snapshot.gpuTempC ?? '—'}°C`} />
            <SensorTile label="MEMORY" value={`${snapshot.ramUsedMb != null ? (snapshot.ramUsedMb / 1024).toFixed(1) : '—'}G RAM · ${snapshot.vramMb != null ? (snapshot.vramMb / 1024).toFixed(1) : '—'}G VRAM`} />
            <SensorTile label="DISK" value={`R ${snapshot.diskReadMbps?.toFixed(1) ?? '—'} · W ${snapshot.diskWriteMbps?.toFixed(1) ?? '—'} MB/s`} />
            <SensorTile label="NETWORK" value={`↓${snapshot.netRecvMbps?.toFixed(2) ?? '—'} · ↑${snapshot.netSentMbps?.toFixed(2) ?? '—'} MB/s`} />
          </Box>
        </Box>
      )}
    </ModalShell>
  );
}

// ── Comparison table (default view) ─────────────────────────────────────────

function ComparisonTable({ data, showUtilization, onSelect }: { data: ComparisonData; showUtilization: boolean; onSelect: (i: number) => void }) {
  // Windowed (region-selected) stats take over the whole row once set — a
  // duration column reading "shortest variant's length" next to a raw AVG
  // would be self-contradictory otherwise.
  const rows = data.variants.map((v, i) => ({ v, d: data.variantData[i], s: v.windowedSummary ?? v.summary }));
  const cols: { key: string; label: string; higherIsBetter?: boolean; get: (r: typeof rows[number]) => number | null; fmt: (n: number | null) => string }[] = [
    { key: 'avg', label: 'AVG', higherIsBetter: true, get: r => r.s?.avgFps ?? null, fmt: n => n == null ? '—' : `${n}` },
    { key: 'low1', label: '1% LOW', higherIsBetter: true, get: r => r.s?.low1pct ?? null, fmt: n => n == null ? '—' : `${n}` },
    { key: 'low01', label: '0.1% LOW', higherIsBetter: true, get: r => r.s?.low01pct ?? null, fmt: n => n == null ? '—' : `${n}` },
    { key: 'min', label: 'MIN', higherIsBetter: true, get: r => r.s?.minFps ?? null, fmt: n => n == null ? '—' : `${n}` },
    { key: 'max', label: 'MAX', get: r => r.s?.maxFps ?? null, fmt: n => n == null ? '—' : `${n}` },
    { key: 'hitches', label: 'HITCHES', higherIsBetter: false, get: r => r.s?.hitches ?? null, fmt: n => n == null ? '—' : `${n}` },
    { key: 'duration', label: 'DURATION', get: r => r.s?.durationS ?? null, fmt: n => n == null ? '—' : `${n}s` },
  ];
  if (showUtilization) {
    cols.push(
      { key: 'gpu', label: 'AVG GPU%', get: r => avgOf(r.d?.sensors ?? [], 'gpuPct'), fmt: n => n == null ? '—' : `${n}%` },
      { key: 'cpu', label: 'AVG CPU%', get: r => avgOf(r.d?.sensors ?? [], 'cpuPct'), fmt: n => n == null ? '—' : `${n}%` },
    );
  }
  const bestByCol = cols.map(c => c.higherIsBetter == null ? null : bestIndex(rows.map(c.get), c.higherIsBetter));

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
        <thead>
          <Box component="tr">
            <Box component="th" sx={{ ...thSx, textAlign: 'left' }}>VARIANT</Box>
            {cols.map(c => <Box component="th" key={c.key} sx={thSx}>{c.label}</Box>)}
          </Box>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <Box
              component="tr"
              key={r.v.base}
              onClick={() => onSelect(i)}
              sx={{ cursor: 'pointer', '&:hover td': { backgroundColor: 'rgba(255,255,255,0.03)' } }}
            >
              <Box component="td" sx={{ ...tdSx, textAlign: 'left' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length], flexShrink: 0 }} />
                  <Box sx={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.v.label}</Box>
                  {r.v.windowedSummary && (
                    <Box
                      {...helpProps('Region Applied', 'This row shows stats from a user-picked slice of the capture (set on the REGION tab), not the whole recording — for a fair comparison against variants that ran a different total length.')}
                      sx={{ fontFamily: 'var(--font-display)', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '4px', px: 0.4, flexShrink: 0 }}
                    >
                      REGION
                    </Box>
                  )}
                </Box>
              </Box>
              {cols.map((c, ci) => (
                <Box component="td" key={c.key} sx={tdSx}>
                  <Box sx={{ fontWeight: bestByCol[ci] === i ? 700 : 400, color: bestByCol[ci] === i ? 'var(--success)' : 'var(--text-primary)' }}>
                    {c.fmt(c.get(r))}
                  </Box>
                </Box>
              ))}
            </Box>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

// ── Overlaid frametime + utilization charts (toggle view) ──────────────────

const SAMPLE_POINTS = 120;

// Same nearest-sample resampling as resample() above, but for a sensor
// timeline (~1 sample/sec, much coarser than the frametime series) and a
// single numeric field — shared by the GPU%/CPU% utilization charts.
function resampleSensorField(sensors: CaptureSensorSample[], xs: number[], field: 'cpuPct' | 'gpuPct'): (number | null)[] {
  if (sensors.length === 0) return xs.map(() => null);
  const lastT = sensors[sensors.length - 1].t;
  return xs.map(x => {
    if (x > lastT + 1.5) return null;
    let best = sensors[0], bestDiff = Math.abs(sensors[0].t - x);
    for (const s of sensors) {
      const diff = Math.abs(s.t - x);
      if (diff < bestDiff) { best = s; bestDiff = diff; }
    }
    return best[field];
  });
}

// One overlaid metric (frametime, GPU%, CPU%) across every variant, sharing
// the same xs — pulled out so the utilization charts don't duplicate the
// frametime chart's axis/series/margin setup.
function OverlaidMetricChart({ title, xs, seriesValues, labels, yMax, height = 140 }: {
  title: string; xs: number[]; seriesValues: (number | null)[][]; labels: string[]; yMax: number; height?: number;
}) {
  return (
    <>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)', mt: 0.5 }}>{title}</Box>
      <LineChart
        height={height}
        skipAnimation
        xAxis={[{ data: xs, scaleType: 'linear', tickNumber: 5, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${Math.round(v)}s` }]}
        yAxis={[{ min: 0, max: yMax, width: 28, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
        series={seriesValues.map((r, i) => ({
          data: r, color: VARIANT_COLORS[i % VARIANT_COLORS.length], showMark: false,
          label: labels[i], connectNulls: false, curve: 'monotoneX',
        }))}
        margin={{ top: 6, bottom: 24, left: 4, right: 12 }}
        sx={{ ...chartSx, '& .MuiChartsLegend-root': { display: 'none' } }}
      />
    </>
  );
}

function ComparisonChart({ data, showUtilization }: { data: ComparisonData; showUtilization: boolean }) {
  const seriesData = data.variantData.map(d => d?.series ?? []);
  const maxT = Math.max(1, ...seriesData.flatMap(s => s.map(p => p.t)));
  const xs = Array.from({ length: SAMPLE_POINTS }, (_, i) => (maxT * i) / (SAMPLE_POINTS - 1));
  const resampledFt = seriesData.map(s => resample(s, xs));
  const maxFt = Math.max(5, ...resampledFt.flatMap(r => r.filter((v): v is number => v != null))) * 1.15;
  const labels = data.variants.map(v => v.label);

  return (
    <>
      {/* MUI's own legend silently display:none's itself when it decides the
          chart is too cramped to fit one — a plain row is more predictable
          and matches the color-dot language already used in the table. */}
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
        {data.variants.map((v, i) => (
          <Box key={v.base} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length], flexShrink: 0 }} />
            <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{v.label}</Box>
          </Box>
        ))}
      </Box>
      <OverlaidMetricChart title="FRAMETIME (ms)" xs={xs} seriesValues={resampledFt} labels={labels} yMax={maxFt} height={220} />
      {showUtilization && (
        <>
          <OverlaidMetricChart
            title="GPU UTILIZATION (%)" xs={xs} labels={labels} yMax={100} height={120}
            seriesValues={data.variantData.map(d => resampleSensorField(d?.sensors ?? [], xs, 'gpuPct'))}
          />
          <OverlaidMetricChart
            title="CPU UTILIZATION (%)" xs={xs} labels={labels} yMax={100} height={120}
            seriesValues={data.variantData.map(d => resampleSensorField(d?.sensors ?? [], xs, 'cpuPct'))}
          />
        </>
      )}
    </>
  );
}

// ── Region selector (Phase 2 — pick a comparable slice per variant) ────────

// Plain inline SVG polyline, not a LineChart — this renders up to 6 of these
// at once as a drag surface; a full MUI X chart per row is unnecessary
// weight (and its auto-axis-width quirk, see the fixed left-margin bug
// elsewhere in this file) for what's just a shape to drag a window over.
function Sparkline({ series, color, height }: { series: CaptureSeriesPoint[]; color: string; height: number }) {
  if (series.length < 2) return <Box sx={{ height }} />;
  const W = 600;
  const maxT = series[series.length - 1].t || 1;
  const maxFt = Math.max(5, ...series.map(p => p.ft));
  const pts = series.map(p => `${(p.t / maxT) * W},${height - (p.ft / maxFt) * height}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const SPARK_H = 56;

function RegionRow({ id, variant, series, color, shortest, onSaved }: {
  id: string; variant: ComparisonData['variants'][number]; series: CaptureSeriesPoint[]; color: string; shortest: number; onSaved: () => void;
}) {
  const duration = variant.summary?.durationS ?? 0;
  const canDrag = duration > shortest + 0.05;
  const [regionStart, setRegionStart] = useState(variant.regionStart ?? 0);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startRegion: number } | null>(null);

  // Picks up the persisted value if this row re-renders with fresh server
  // data (e.g. after another row's save triggers a refetch) — but not while
  // a drag is actually in progress, or the position would jump mid-gesture.
  useEffect(() => { if (!dragRef.current) setRegionStart(variant.regionStart ?? 0); }, [variant.regionStart]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!canDrag) return;
    setSaveFailed(false);
    dragRef.current = { startX: e.clientX, startRegion: regionStart };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaS = ((e.clientX - dragRef.current.startX) / rect.width) * duration;
    setRegionStart(Math.max(0, Math.min(duration - shortest, dragRef.current.startRegion + deltaS)));
  }
  async function onPointerUp() {
    if (!dragRef.current) return;
    dragRef.current = null;
    setSaving(true);
    const start = Math.round(regionStart * 100) / 100;
    const end = Math.round((regionStart + shortest) * 100) / 100;
    const result = await setComparisonVariantRegion(id, variant.base, start, end);
    setSaving(false);
    setSaveFailed(!result.ok);
    if (result.ok) onSaved();
  }

  const leftPct = duration > 0 ? (regionStart / duration) * 100 : 0;
  const widthPct = duration > 0 ? Math.min(100, (shortest / duration) * 100) : 100;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.5 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
        <Box sx={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{variant.label}</Box>
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--text-dim)' }}>
          · {duration}s{canDrag ? ` · region ${regionStart.toFixed(1)}–${(regionStart + shortest).toFixed(1)}s` : ' · full range (shortest variant)'}
        </Box>
        {saving && <CircularProgress size={11} sx={{ color: 'var(--accent)' }} />}
        {saveFailed && (
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--error)' }}>
            SAVE FAILED — TAP THE WINDOW TO RETRY
          </Box>
        )}
      </Box>
      <Box
        ref={containerRef}
        sx={{ position: 'relative', height: SPARK_H, borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: saveFailed ? 'var(--error)' : 'var(--border)' }}
      >
        <Sparkline series={series} color={color} height={SPARK_H} />
        {canDrag && (
          <Box
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            sx={{
              position: 'absolute', top: 0, bottom: 0, left: `${leftPct}%`, width: `${widthPct}%`,
              backgroundColor: 'rgba(245,158,11,0.18)', border: '1px solid var(--accent)', boxSizing: 'border-box',
              cursor: 'ew-resize', touchAction: 'none',
            }}
          />
        )}
      </Box>
    </Box>
  );
}

function RegionSelector({ id, data, onSaved }: { id: string; data: ComparisonData; onSaved: () => void }) {
  const shortest = shortestDurationS(data);
  if (shortest == null) {
    return <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 2, textAlign: 'center' }}>No duration data to work with yet.</Box>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
        Drag each variant&apos;s window to the {shortest}s slice you want compared — width is fixed to the shortest variant&apos;s duration. Saves automatically when you let go.
      </Box>
      {data.variants.map((v, i) => (
        <RegionRow key={v.base} id={id} variant={v} series={data.variantData[i]?.series ?? []} color={VARIANT_COLORS[i % VARIANT_COLORS.length]} shortest={shortest} onSaved={onSaved} />
      ))}
    </Box>
  );
}

// ── Main dialog ──────────────────────────────────────────────────────────────

export function ComparisonViewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const queryKey = ['perf', 'comparison-data', id];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchComparisonData(id),
    gcTime: 0,
  });
  const [view, setView] = useState<'table' | 'chart' | 'region'>('table');
  const [showUtilization, setShowUtilization] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const refetchData = () => qc.invalidateQueries({ queryKey });

  const tabBtn = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 0.4, px: 1, py: 0.4, borderRadius: '6px', cursor: 'pointer',
    fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em',
    border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
  } as const);

  return (
    <>
      <ModalShell onClose={onClose} maxWidth={680}>
        <DialogHeader title={data ? `${data.label}` : 'COMPARISON'} onClose={onClose} />
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} sx={{ color: 'var(--accent)' }} /></Box>
        ) : !data ? (
          <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-dim)', py: 3, textAlign: 'center' }}>Comparison not found.</Box>
        ) : (
          <>
            <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', mt: -1 }}>
              {data.process} · {fmtDate(data.createdAt)} · {data.variants.length} variants
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Box sx={tabBtn(view === 'table')} onClick={() => setView('table')}><TableRowsIcon sx={{ fontSize: 13 }} /> TABLE</Box>
                <Box sx={tabBtn(view === 'chart')} onClick={() => setView('chart')}><ShowChartIcon sx={{ fontSize: 13 }} /> CHART</Box>
                <Box
                  sx={tabBtn(view === 'region')}
                  onClick={() => setView('region')}
                  {...helpProps('Region', "Pick a comparable time slice from each variant when they ran for different lengths — HandyMon can't force identical replay across runs, so this lets you choose the representative window yourself.")}
                >
                  <CropIcon sx={{ fontSize: 13 }} /> REGION
                </Box>
              </Box>
              {(view === 'table' || view === 'chart') && (
                <Box
                  {...helpProps('System Utilization', view === 'table'
                    ? 'Shows two extra columns — average GPU% and average CPU% for each variant — to help spot whether the bottleneck shifted between settings. Off by default to keep the table compact.'
                    : 'Adds GPU% and CPU% over time below the frametime chart, one line per variant — to see whether the bottleneck shifted, not just the average. Off by default to keep the chart compact.')}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}
                >
                  <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-dim)' }}>UTILIZATION</Box>
                  <ToggleSwitch checked={showUtilization} onChange={() => setShowUtilization(v => !v)} size="sm" />
                </Box>
              )}
            </Box>

            {durationMismatch(data) && (
              <Box
                {...helpProps('Duration Mismatch', "These variants ran for noticeably different lengths of time, so raw stats (especially HITCHES) aren't directly apples-to-apples — a longer run has more opportunity to hit a stutter. Use the REGION tab to pick a matching slice from each and this note goes away.")}
                sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--warning)', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px dashed var(--warning)', borderRadius: '8px', px: 1, py: 0.6 }}
              >
                Durations vary significantly — raw counts aren&apos;t directly comparable. Try REGION to pick a matching slice.
              </Box>
            )}

            {view === 'table' ? (
              <ComparisonTable data={data} showUtilization={showUtilization} onSelect={setDetailIndex} />
            ) : view === 'chart' ? (
              <ComparisonChart data={data} showUtilization={showUtilization} />
            ) : (
              <RegionSelector id={id} data={data} onSaved={refetchData} />
            )}
          </>
        )}
      </ModalShell>
      {data && detailIndex !== null && data.variantData[detailIndex] && (
        <VariantDetail
          data={{ ...data.variantData[detailIndex]!, label: data.variants[detailIndex].label, process: data.process }}
          color={VARIANT_COLORS[detailIndex % VARIANT_COLORS.length]}
          onClose={() => setDetailIndex(null)}
        />
      )}
    </>
  );
}
