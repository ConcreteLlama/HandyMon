'use client';

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Box, CircularProgress } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import { useQuery } from '@tanstack/react-query';
import CloseIcon from '@mui/icons-material/Close';
import BarChartIcon from '@mui/icons-material/BarChart';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { useCaptures, fetchCaptureData } from '@/hooks/perf/useCaptures';
import { useComparisons, createComparisonFromCaptures } from '@/hooks/perf/useComparisons';
import { ComparisonViewDialog } from './ComparisonView';
import type { CaptureFileInfo, CaptureSensorSample } from '@/types/perf';
import { chartSx, AXIS_LABEL_COLOR } from './cards/shared';
import { helpProps } from '@/components/help/HelpModeContext';
import { ModalShell } from '@/components/ui/ModalShell';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { DialogButtons } from '@/components/ui/DialogButtons';
import { FormLabel } from '@/components/ui/FormLabel';
import { fieldStyle } from '@/components/ui/fieldStyle';

const FT_COLOR = '#ef4444';
const HITCH_COLOR = '#fb923c';

// Sample with the `t` (seconds since capture start) closest to the target —
// the sensor timeline is sampled once a second while the frame CSV has one
// row per frame, so an exact match is never expected, just the nearest.
function nearestSample(sensors: CaptureSensorSample[], t: number): CaptureSensorSample | null {
  if (sensors.length === 0) return null;
  let best = sensors[0], bestDiff = Math.abs(sensors[0].t - t);
  for (const s of sensors) {
    const diff = Math.abs(s.t - t);
    if (diff < bestDiff) { best = s; bestDiff = diff; }
  }
  return best;
}

function SensorTile({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '7px', px: 1, py: 0.7 }}>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</Box>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)', mt: 0.2 }}>{label}</Box>
    </Box>
  );
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function overlay(children: ReactNode, onClose: () => void, z: number) {
  return createPortal(
    <Box sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: z, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }} onClick={onClose}>
      <Box sx={{ width: '100%', maxWidth: 620, maxHeight: '86vh', overflowY: 'auto', backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }} onClick={e => e.stopPropagation()}>
        {children}
      </Box>
    </Box>,
    document.body,
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.05em', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Box>
      <Box onClick={onClose} sx={{ cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', flexShrink: 0, '&:hover': { color: 'var(--text-primary)' } }}><CloseIcon sx={{ fontSize: 18 }} /></Box>
    </Box>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', px: 1.5, py: 0.75, minWidth: 52 }}>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</Box>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)', mt: 0.3 }}>{label}</Box>
    </Box>
  );
}

// ── View one capture (summary + frametime graph) ─────────────────────────────

function CaptureViewDialog({ capture, onClose }: { capture: CaptureFileInfo; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['perf', 'capture-data', capture.file],
    queryFn: () => fetchCaptureData(capture.file),
    gcTime: 0,
  });
  const s = capture.summary;
  const series = data?.series ?? [];
  const hitchTimes = data?.hitchTimes ?? [];
  const sensors = data?.sensors ?? [];

  // null = nothing selected yet; NEXT from here jumps to the first hitch.
  const [selHitch, setSelHitch] = useState<number | null>(null);
  function stepHitch(delta: number) {
    if (hitchTimes.length === 0) return;
    setSelHitch(prev => prev === null ? (delta > 0 ? 0 : hitchTimes.length - 1) : Math.min(hitchTimes.length - 1, Math.max(0, prev + delta)));
  }
  const selectedT = selHitch !== null ? hitchTimes[selHitch] : null;
  const snapshot = selectedT !== null ? nearestSample(sensors, selectedT) : null;

  return overlay(
    <>
      <Header title={`${capture.process} · ${fmtDate(capture.startedAt)}`} onClose={onClose} />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Stat label="AVG" value={`${s.avgFps ?? '—'}`} color="#f59e0b" />
        <Stat label="1% LOW" value={`${s.low1pct ?? '—'}`} color="#ec4899" />
        <Stat label="0.1% LOW" value={`${s.low01pct ?? '—'}`} color="#a855f7" />
        <Stat label="MIN" value={`${s.minFps ?? '—'}`} color="#10b981" />
        <Stat label="MAX" value={`${s.maxFps ?? '—'}`} color="var(--text-dim)" />
        <Stat label="HITCHES" value={`${s.hitches ?? '—'}`} color={HITCH_COLOR} />
      </Box>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--text-dim)' }}>
        {s.frames.toLocaleString()} frames · {s.durationS}s · ended: {s.endReason}
      </Box>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', mt: 0.5 }}>FRAMETIME (ms) — spikes are stutters</Box>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} sx={{ color: 'var(--accent)' }} /></Box>
      ) : series.length > 1 ? (
        <LineChart
          height={200}
          skipAnimation
          xAxis={[{ data: series.map(p => p.t), scaleType: 'linear', tickNumber: 5, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${Math.round(v)}s` }]}
          yAxis={[{ min: 0, max: Math.max(5, ...series.map(p => p.ft)) * 1.15, width: 28, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${v}` }]}
          series={[{ data: series.map(p => p.ft), color: FT_COLOR, area: true, showMark: false, label: 'ms' }]}
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
          <Box
            {...helpProps('Hitches', "Every stutter this capture flagged — jump between them with the arrows to see the frame chart marker and (if available) what the system was doing right around that moment.")}
            sx={{ fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)' }}
          >
            {selHitch !== null ? `HITCH ${selHitch + 1} / ${hitchTimes.length} — at ${hitchTimes[selHitch]}s` : `${hitchTimes.length} HITCH${hitchTimes.length !== 1 ? 'ES' : ''}`}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Box
              onClick={() => stepHitch(-1)}
              sx={{ display: 'flex', p: 0.4, borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', '&:hover': { borderColor: HITCH_COLOR, color: HITCH_COLOR } }}
            >
              <ChevronLeftIcon sx={{ fontSize: 16 }} />
            </Box>
            <Box
              onClick={() => stepHitch(1)}
              sx={{ display: 'flex', p: 0.4, borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', '&:hover': { borderColor: HITCH_COLOR, color: HITCH_COLOR } }}
            >
              <ChevronRightIcon sx={{ fontSize: 16 }} />
            </Box>
          </Box>
        </Box>
      )}

      {selHitch !== null && (
        snapshot ? (
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
        ) : (
          <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center', py: 1 }}>
            no system snapshot data for this capture
          </Box>
        )
      )}
    </>,
    onClose, 410,
  );
}

// ── Build a Comparison from already-taken captures ──────────────────────────

function CreateComparisonDialog({ captures, onCreate, onClose }: {
  captures: CaptureFileInfo[];
  onCreate: (label: string | undefined, items: { file: string; label?: string }[]) => Promise<void>;
  onClose: () => void;
}) {
  const [comparisonLabel, setComparisonLabel] = useState('');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    await onCreate(comparisonLabel.trim() || undefined, captures.map(c => ({ file: c.file, label: labels[c.file]?.trim() || undefined })));
    setCreating(false);
  }

  return (
    <ModalShell onClose={onClose} maxWidth={420}>
      <DialogHeader title="CREATE COMPARISON" onClose={onClose} />
      <Box sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, mt: -1 }}>
        Compares these {captures.length} captures side by side. Both labels are optional.
      </Box>
      <Box>
        <FormLabel>COMPARISON LABEL</FormLabel>
        <input value={comparisonLabel} onChange={e => setComparisonLabel(e.target.value)} placeholder={captures[0]?.process ?? ''} style={fieldStyle} spellCheck={false} autoFocus />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {captures.map(c => (
          <Box key={c.file}>
            <FormLabel>{fmtDate(c.startedAt)} · avg {c.summary.avgFps ?? '—'} · {c.summary.durationS}s</FormLabel>
            <input
              value={labels[c.file] ?? ''}
              onChange={e => setLabels(l => ({ ...l, [c.file]: e.target.value }))}
              placeholder={c.process}
              style={fieldStyle}
              spellCheck={false}
            />
          </Box>
        ))}
      </Box>
      <DialogButtons onCancel={onClose} onConfirm={handleCreate} confirmLabel={creating ? 'CREATING…' : 'CREATE'} confirmDisabled={creating} />
    </ModalShell>
  );
}

// ── History list ─────────────────────────────────────────────────────────────

export function CaptureHistoryDialog({ onClose }: { onClose: () => void }) {
  const { captures, capFrameXAvailable, remove, openInCapFrameX } = useCaptures();
  const { comparisons, isLoading: comparisonsLoading, refresh: refreshComparisons, remove: removeComparison } = useComparisons();
  const [view, setView] = useState<CaptureFileInfo | null>(null);
  const [viewComparisonId, setViewComparisonId] = useState<string | null>(null);
  const [tab, setTab] = useState<'captures' | 'comparisons'>('captures');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  function toggleSelectMode() {
    setSelectMode(v => !v);
    setSelected(new Set());
  }
  function toggleSelected(file: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file); else next.add(file);
      return next;
    });
  }
  async function handleCreateComparison(label: string | undefined, items: { file: string; label?: string }[]) {
    const result = await createComparisonFromCaptures(label, items);
    if (result.ok && result.id) {
      setCreateOpen(false);
      setSelectMode(false);
      setSelected(new Set());
      refreshComparisons();
      setTab('comparisons');
      setViewComparisonId(result.id);
    }
  }

  const btn = {
    px: 1, py: 0.4, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 0.4, color: 'var(--text-secondary)',
    fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em',
    '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
  } as const;

  const tabBtn = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 0.4, px: 1, py: 0.4, borderRadius: '6px', cursor: 'pointer',
    fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em',
    border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
  } as const);

  return (
    <>
      {overlay(
        <>
          <Header title="CAPTURE HISTORY" onClose={onClose} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Box sx={tabBtn(tab === 'captures')} onClick={() => setTab('captures')}><BarChartIcon sx={{ fontSize: 13 }} /> CAPTURES</Box>
              <Box sx={tabBtn(tab === 'comparisons')} onClick={() => setTab('comparisons')}><CompareArrowsIcon sx={{ fontSize: 13 }} /> COMPARISONS</Box>
            </Box>
            {tab === 'captures' && captures.length >= 2 && (
              <Box
                sx={tabBtn(selectMode)}
                onClick={toggleSelectMode}
                {...helpProps('Compare', 'Pick two or more existing captures and build a Comparison from them — for "actually, was that config better" after the fact, without having to re-record anything.')}
              >
                <CompareArrowsIcon sx={{ fontSize: 13 }} /> {selectMode ? 'CANCEL' : 'COMPARE'}
              </Box>
            )}
          </Box>
          {selectMode && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, backgroundColor: 'rgba(245,158,11,0.08)', border: '1px dashed var(--accent)', borderRadius: '8px', px: 1, py: 0.6 }}>
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {selected.size} selected{selected.size < 2 ? ' — pick at least 2' : ''}
              </Box>
              <Box
                onClick={() => selected.size >= 2 && setCreateOpen(true)}
                sx={{
                  ...btn,
                  borderColor: selected.size >= 2 ? 'var(--accent)' : 'var(--border)',
                  color: selected.size >= 2 ? 'var(--accent)' : 'var(--text-dim)',
                  cursor: selected.size >= 2 ? 'pointer' : 'default',
                }}
              >
                CREATE COMPARISON
              </Box>
            </Box>
          )}
          {tab === 'captures' ? (
            captures.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                No captures yet — hit CAPTURE on the Frame page while a game runs.
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {captures.map(c => (
                  <Box
                    key={c.file}
                    onClick={selectMode ? () => toggleSelected(c.file) : undefined}
                    sx={{
                      border: '1px solid', borderColor: selectMode && selected.has(c.file) ? 'var(--accent)' : 'var(--border)',
                      borderRadius: '10px', p: 1.25, backgroundColor: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
                      cursor: selectMode ? 'pointer' : 'default',
                    }}
                  >
                    {selectMode && (
                      selected.has(c.file)
                        ? <CheckBoxIcon sx={{ fontSize: 18, color: 'var(--accent)', flexShrink: 0 }} />
                        : <CheckBoxOutlineBlankIcon sx={{ fontSize: 18, color: 'var(--text-dim)', flexShrink: 0 }} />
                    )}
                    <Box sx={{ flex: 1, minWidth: 140 }}>
                      <Box sx={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.process}</Box>
                      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: 'var(--text-dim)', mt: 0.15 }}>
                        {fmtDate(c.startedAt)} · {c.summary.durationS}s · avg {c.summary.avgFps ?? '—'} · 1% {c.summary.low1pct ?? '—'}
                      </Box>
                    </Box>
                    {!selectMode && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                        <Box sx={btn} onClick={() => setView(c)}><BarChartIcon sx={{ fontSize: 13 }} /> VIEW</Box>
                        {capFrameXAvailable && (
                          <Box
                            sx={btn}
                            onClick={() => openInCapFrameX(c.file)}
                            {...helpProps('Open in CapFrameX', 'This capture is saved as a CapFrameX-compatible CSV — opens it directly in the CapFrameX app (detected as installed on this PC) for its own deeper analysis tools.')}
                          >
                            <LaunchIcon sx={{ fontSize: 13 }} /> CAPFRAMEX
                          </Box>
                        )}
                        <Box sx={{ ...btn, '&:hover': { borderColor: 'var(--error)', color: 'var(--error)' } }} onClick={() => remove(c.file)}><DeleteOutlineIcon sx={{ fontSize: 13 }} /></Box>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )
          ) : comparisonsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} sx={{ color: 'var(--accent)' }} /></Box>
          ) : comparisons.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
              No comparisons yet — hit COMPARE on the Frame page while a game runs.
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {comparisons.map(c => (
                <Box key={c.id} sx={{ border: '1px solid var(--border)', borderRadius: '10px', p: 1.25, backgroundColor: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: 1, minWidth: 140 }}>
                    <Box sx={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</Box>
                    <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: 'var(--text-dim)', mt: 0.15 }}>
                      {fmtDate(c.createdAt)} · {c.process} · {c.variantCount} variant{c.variantCount !== 1 ? 's' : ''}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Box sx={btn} onClick={() => setViewComparisonId(c.id)}><CompareArrowsIcon sx={{ fontSize: 13 }} /> VIEW</Box>
                    <Box sx={{ ...btn, '&:hover': { borderColor: 'var(--error)', color: 'var(--error)' } }} onClick={() => removeComparison(c.id)}><DeleteOutlineIcon sx={{ fontSize: 13 }} /></Box>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </>,
        onClose, 400,
      )}
      {view && <CaptureViewDialog capture={view} onClose={() => setView(null)} />}
      {viewComparisonId && <ComparisonViewDialog id={viewComparisonId} onClose={() => setViewComparisonId(null)} />}
      {createOpen && (
        <CreateComparisonDialog
          captures={captures.filter(c => selected.has(c.file))}
          onCreate={handleCreateComparison}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </>
  );
}
