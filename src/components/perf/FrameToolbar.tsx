'use client';

import { useState } from 'react';
import { Box, CircularProgress, Popover } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import TuneIcon from '@mui/icons-material/Tune';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import BlockIcon from '@mui/icons-material/Block';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PauseIcon from '@mui/icons-material/Pause';
import { useQueryClient } from '@tanstack/react-query';
import { CaptureHistoryDialog } from './CaptureHistory';
import { ManageExclusionsDialog } from './ManageExclusionsDialog';
import { ComparisonViewDialog } from './ComparisonView';
import { formatDuration } from './cards/shared';
import { AppConfigApi } from '@/app/api/config/api';
import { useAppConfig, useUpdateAppConfig } from '@/hooks/config/useAppConfig';
import { useFpsData } from '@/hooks/perf/useFpsData';
import { useCaptureRun } from '@/hooks/perf/useCaptureRun';
import { useComparisonRun } from '@/hooks/perf/useComparisons';
import { useFpsPin } from '@/hooks/perf/useFpsPin';
import { showToast } from '@/components/ui/Toast';
import { helpProps } from '@/components/help/HelpModeContext';
import { ModalShell } from '@/components/ui/ModalShell';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { DialogButtons } from '@/components/ui/DialogButtons';
import { FormLabel } from '@/components/ui/FormLabel';
import { fieldStyle } from '@/components/ui/fieldStyle';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';

// Escapes regex metacharacters so a quick-exclude matches the exe name
// exactly by default — a hand-edited pattern (Manage Exclusions dialog) can
// still be broader. Duplicated (not imported) from the server-side copy in
// app-config.ts since this file is client code and can't pull in anything
// from a Node-only module.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const iconBtnSx = {
  px: { xs: 1, sm: 1.5 }, py: 0.6, borderRadius: 6, border: '1px solid var(--border)',
  backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)',
  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.72rem',
  letterSpacing: '0.05em', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 0.5,
  '&:hover': { backgroundColor: 'var(--border)' },
} as const;

// Five buttons' worth of text ("CAPTURE"/"SELECT"/"HISTORY"/"CONFIG"/"RESET")
// wraps badly at phone widths — below `sm` they collapse to icon-only (the
// icons are distinct enough on their own: dot/pin/clock/tune/refresh), title
// attributes on each button keep the label available on hover/long-press.
const labelSx = { display: { xs: 'none', sm: 'inline' } } as const;

function TuneRow({ label, hint, value, min, max, step, onCommit }: {
  label: string; hint: string; value: number; min: number; max: number; step: number; onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value));
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)', mb: 0.4 }}>{label}</Box>
      <input
        type="number" min={min} max={max} step={step} value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { const n = Math.min(max, Math.max(min, Number(local) || value)); setLocal(String(n)); if (n !== value) onCommit(n); }}
        style={{
          width: '100%', padding: '0.45rem 0.6rem', backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)', fontSize: '0.8rem', outline: 'none',
        }}
      />
      <Box sx={{ fontSize: '0.62rem', color: 'var(--text-dim)', mt: 0.3 }}>{hint}</Box>
    </Box>
  );
}

// Prompts for both labels and starts — comparison label groups the whole
// session (e.g. "DLSS Quality Modes"), variant label is what changed for
// this first recording specifically (e.g. "Quality"). Both optional —
// blank comparison label falls back to the process name, blank variant
// label falls back to "Variant 1".
function NewComparisonDialog({ onStart, onClose }: { onStart: (label?: string, variantLabel?: string) => void; onClose: () => void }) {
  const [label, setLabel] = useState('');
  const [variantLabel, setVariantLabel] = useState('');
  return (
    <ModalShell onClose={onClose} maxWidth={360}>
      <DialogHeader title="NEW COMPARISON" onClose={onClose} />
      <Box sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, mt: -1 }}>
        Capture multiple labeled settings configs back-to-back, then compare them side by side. Both labels are optional.
      </Box>
      <Box>
        <FormLabel>COMPARISON LABEL</FormLabel>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. DLSS Quality Modes" style={fieldStyle} spellCheck={false} autoFocus />
      </Box>
      <Box>
        <FormLabel>FIRST VARIANT LABEL</FormLabel>
        <input value={variantLabel} onChange={e => setVariantLabel(e.target.value)} placeholder="e.g. Quality" style={fieldStyle} spellCheck={false} />
      </Box>
      <DialogButtons onCancel={onClose} onConfirm={() => onStart(label, variantLabel)} confirmLabel="START" />
    </ModalShell>
  );
}

function NextVariantDialog({ firstVariantLabel, firstVariantDurationS, onContinue, onClose }: {
  firstVariantLabel?: string; firstVariantDurationS?: number;
  onContinue: (label: string | undefined, matchFirstDuration: boolean) => void; onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  const [matchDuration, setMatchDuration] = useState(false);
  return (
    <ModalShell onClose={onClose} maxWidth={320}>
      <DialogHeader title="NEXT VARIANT" onClose={onClose} />
      <Box>
        <FormLabel>VARIANT LABEL</FormLabel>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Balanced" style={fieldStyle} spellCheck={false} autoFocus />
      </Box>
      {firstVariantDurationS != null && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <ToggleSwitch checked={matchDuration} onChange={() => setMatchDuration(v => !v)} size="sm" />
          <Box sx={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            Match {firstVariantLabel ?? 'first variant'}&apos;s duration ({firstVariantDurationS}s) — auto-stops this recording at the same length
          </Box>
        </Box>
      )}
      <DialogButtons onCancel={onClose} onConfirm={() => onContinue(label, matchDuration)} confirmLabel="GO" />
    </ModalShell>
  );
}

// PresentMon connection status + CAPTURE/HISTORY/CONFIG/RESET controls —
// shared between the FPS tab (always shown) and the OVERVIEW tab (shown only
// when a Frame card is actually pinned there, since otherwise there's
// nothing on-screen for these controls to apply to).
export function FrameToolbar() {
  const [resetting, setResetting] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exclusionsOpen, setExclusionsOpen] = useState(false);
  const [newComparisonOpen, setNewComparisonOpen] = useState(false);
  const [nextVariantOpen, setNextVariantOpen] = useState(false);
  const [viewComparisonId, setViewComparisonId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data: config } = useAppConfig();
  const { mutateAsync: updateConfig } = useUpdateAppConfig();
  const { process, pinnedProcess, connected, sessionSeconds } = useFpsData();
  const { status: capture, start: startCapture, stop: stopCapture, clear: clearCapture } = useCaptureRun();
  const comparison = useComparisonRun();
  const { candidates, loading: candidatesLoading, loadCandidates, clearCandidates, pin, unpin } = useFpsPin();

  async function startComparison(label?: string, variantLabel?: string) {
    setNewComparisonOpen(false);
    await comparison.start(label, variantLabel);
  }
  async function continueComparison(label: string | undefined, matchFirstDuration: boolean) {
    setNextVariantOpen(false);
    await comparison.continueWith(label, matchFirstDuration);
  }
  async function finishComparison() {
    const result = await comparison.finish();
    if (result?.finishedId) setViewComparisonId(result.finishedId);
  }

  async function toggleExclude(key: string) {
    if (!config) return;
    const current = config.processExclusions ?? [];
    const escaped = escapeRegExp(key);
    // A quick un-exclude only ever removes patterns THIS quick-exclude could
    // have added (an exact escaped match) — a broader hand-authored pattern
    // that happens to also match stays put, since undoing that silently
    // would surprise whoever wrote it in Manage Exclusions.
    const next = current.includes(escaped) ? current.filter(p => p !== escaped) : [...current, escaped];
    await updateConfig({ ...config, processExclusions: next });
    loadCandidates(); // re-sort/greys immediately instead of waiting for the next popover open
  }

  function openPicker(el: HTMLElement) {
    setPickerAnchor(el);
    loadCandidates();
  }
  function closePicker() {
    setPickerAnchor(null);
    clearCandidates();
  }
  async function pickAndClose(c: Parameters<typeof pin>[0]) {
    closePicker();
    await pin(c);
  }

  async function reset() {
    setResetting(true);
    try {
      await AppConfigApi.resetFps();                     // clear server session buffers
      window.dispatchEvent(new Event('perf-reset'));     // clear client chart history
      await qc.invalidateQueries({ queryKey: ['perf', 'fps'] }); // reflect immediately
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to reset', 'error');
    }
    finally { setResetting(false); }
  }

  const commit = (patch: Partial<{ fpsPollMs: number; fpsWindowMs: number; fpsGraphSeconds: number; hitchThreshold: number }>) => {
    if (config) updateConfig({ ...config, ...patch });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Below `sm` this is a deliberate two-row toolbar (status full-width on
          top, buttons as their own evenly-spaced row) rather than relying on
          flexWrap to improvise a break — an emergent wrap left the button row
          right-floating with a dead gap to its left whenever the status text
          was too long to share the row, which read as broken, not responsive. */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0, flexShrink: 1 }}>
          {comparison.status.active ? (
            <>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, backgroundColor: comparison.status.state === 'capturing' ? '#ef4444' : 'var(--warning)' }} />
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {comparison.status.state === 'capturing'
                  ? `Recording ${comparison.status.currentVariantLabel} · ${comparison.status.currentVariantElapsedS ?? 0}s`
                  : `Paused — ${comparison.status.variantsCompleted ?? 0} variant${comparison.status.variantsCompleted !== 1 ? 's' : ''} captured`}
              </Box>
            </>
          ) : connected && pinnedProcess ? (
            <>
              <PushPinIcon sx={{ fontSize: 13, color: 'var(--accent)', flexShrink: 0 }} />
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title="Pinned — auto-releases when this process exits">
                {pinnedProcess}
              </Box>
              <CloseIcon onClick={unpin} titleAccess="Unpin (back to auto-detect)" sx={{ fontSize: 13, color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0, '&:hover': { color: 'var(--error)' } }} />
            </>
          ) : connected && process ? (
            <>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }} />
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {process}
              </Box>
            </>
          ) : (
            <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
              {connected ? 'no active game' : 'PresentMon not capturing'}
            </Box>
          )}
          {connected && sessionSeconds !== null && (
            <Box
              title="How long the AVG / lows / hitch stats below cover — resets on RESET, a capture restart, or the game exiting"
              {...helpProps('Session', "How long the AVG / lows / hitch stats in FRAME STATS cover. Resets on RESET, a capture restart, or the game exiting.")}
              sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              · session {formatDuration(sessionSeconds)}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexGrow: 1, flexWrap: 'wrap', justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
          {comparison.status.active ? (
            <>
              {comparison.status.state === 'capturing' ? (
                <Box onClick={() => comparison.pause()} title="Pause comparison" {...helpProps('Pause', "Stops the current variant's capture and saves it — the comparison stays open so you can change settings before starting the next variant.")} sx={{ ...iconBtnSx, borderColor: 'var(--warning)', color: 'var(--warning)' }}>
                  <PauseIcon sx={{ fontSize: 14 }} />
                  <Box component="span" sx={labelSx}>PAUSE</Box>
                </Box>
              ) : (
                <Box onClick={() => setNextVariantOpen(true)} title="Capture next variant" {...helpProps('Continue', 'Starts capturing the next labeled variant in this comparison.')} sx={iconBtnSx}>
                  <FiberManualRecordIcon sx={{ fontSize: 12, color: '#ef4444' }} />
                  <Box component="span" sx={labelSx}>CONTINUE</Box>
                </Box>
              )}
              <Box onClick={finishComparison} title="Finish comparison" {...helpProps('Finish', 'Ends the comparison and opens the viewer to see all captured variants side by side.')} sx={{ ...iconBtnSx, borderColor: 'var(--success)', color: 'var(--success)' }}>
                <CompareArrowsIcon sx={{ fontSize: 14 }} />
                <Box component="span" sx={labelSx}>FINISH</Box>
              </Box>
            </>
          ) : capture.active ? (
            <Box onClick={stopCapture} title="Stop capture" {...helpProps('Stop', 'Ends the current PresentMon capture run and saves it to HISTORY as a CapFrameX-compatible CSV.')} sx={{ ...iconBtnSx, borderColor: 'var(--error)', color: 'var(--error)' }}>
              <StopIcon sx={{ fontSize: 14 }} />
              <Box component="span" sx={labelSx}>STOP ·&nbsp;</Box>
              {capture.elapsedS ?? 0}s
            </Box>
          ) : (
            <>
              <Box onClick={startCapture} title="Capture" {...helpProps('Capture', 'Starts a dedicated recording run (separate from the always-on live stats) that gets saved to HISTORY when stopped — for keeping a specific benchmark run instead of just watching live numbers.')} sx={iconBtnSx}>
                <FiberManualRecordIcon sx={{ fontSize: 12, color: '#ef4444' }} />
                <Box component="span" sx={labelSx}>CAPTURE</Box>
              </Box>
              <Box onClick={() => setNewComparisonOpen(true)} title="Compare settings" {...helpProps('Compare', 'Captures multiple labeled settings configs back-to-back, then shows them side by side — for answering "which setting is actually better" instead of eyeballing one run at a time.')} sx={iconBtnSx}>
                <CompareArrowsIcon sx={{ fontSize: 14 }} />
                <Box component="span" sx={labelSx}>COMPARE</Box>
              </Box>
            </>
          )}
          <Box onClick={e => openPicker(e.currentTarget)} title="Select a process to track" {...helpProps('Select', "Manually pin FPS tracking to a specific process instead of relying on auto-detect — useful when the game you want isn't the one auto-detected (e.g. a launcher or overlay process is presenting frames too).")} sx={iconBtnSx}>
            <PushPinOutlinedIcon sx={{ fontSize: 14 }} />
            <Box component="span" sx={labelSx}>SELECT</Box>
          </Box>
          <Box onClick={() => setHistoryOpen(true)} title="Capture history" {...helpProps('History', 'Past CAPTURE runs — view their stats/graph, delete them, or open the saved CSV in CapFrameX if installed.')} sx={iconBtnSx}>
            <HistoryIcon sx={{ fontSize: 14 }} />
            <Box component="span" sx={labelSx}>HISTORY</Box>
          </Box>
          <Box onClick={e => setAnchor(e.currentTarget)} title="FPS config" {...helpProps('Config', 'Tune how often FPS updates, how much smoothing is applied, how many seconds the graphs show, and what counts as a "hitch" — plus process exclusions for the SELECT picker.')} sx={iconBtnSx}>
            <TuneIcon sx={{ fontSize: 14 }} />
            <Box component="span" sx={labelSx}>CONFIG</Box>
          </Box>
          <Box onClick={resetting ? undefined : reset} title="Reset" {...helpProps('Reset', 'Clears the current session’s accumulated stats (AVG, lows, hitches, session timer) and chart history — doesn’t stop or affect a CAPTURE run.')} sx={{ ...iconBtnSx, cursor: resetting ? 'default' : 'pointer' }}>
            {resetting ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : <RestartAltIcon sx={{ fontSize: 14 }} />}
            <Box component="span" sx={labelSx}>RESET</Box>
          </Box>
        </Box>
      </Box>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', p: 2, width: 240, mt: 0.5 } } }}
      >
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.05em', color: 'var(--text-primary)', mb: 1.5 }}>
          FPS CONFIG
        </Box>
        {config && (
          <>
            <TuneRow label="REFRESH RATE" hint="How often the FPS updates (lower = snappier)" value={config.fpsPollMs} min={100} max={2000} step={50} onCommit={v => commit({ fpsPollMs: v })} />
            <TuneRow label="SMOOTHING WINDOW" hint="FPS averaged over this window (higher = steadier)" value={config.fpsWindowMs} min={200} max={3000} step={100} onCommit={v => commit({ fpsWindowMs: v })} />
            <TuneRow label="GRAPH WINDOW (s)" hint="How many seconds the graphs show" value={config.fpsGraphSeconds} min={5} max={120} step={5} onCommit={v => commit({ fpsGraphSeconds: v })} />
            <TuneRow label="HITCH SENSITIVITY (×)" hint="Hitch = frametime above N× local avg (lower = stricter)" value={config.hitchThreshold} min={1.2} max={5} step={0.1} onCommit={v => commit({ hitchThreshold: v })} />
            <Box
              onClick={() => { setAnchor(null); setExclusionsOpen(true); }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'pointer',
                borderTop: '1px solid var(--border)', pt: 1.5, mt: 0.5,
                fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.05em',
                color: 'var(--text-dim)', '&:hover': { color: 'var(--accent)' },
              }}
            >
              <BlockIcon sx={{ fontSize: 14 }} /> MANAGE EXCLUSIONS
            </Box>
          </>
        )}
      </Popover>

      <Popover
        open={!!pickerAnchor}
        anchorEl={pickerAnchor}
        onClose={closePicker}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', p: 1.5, width: 260, maxHeight: 320, mt: 0.5, overflowY: 'auto' } } }}
      >
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.05em', color: 'var(--text-primary)', mb: 1 }}>
          TRACK A PROCESS
        </Box>
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-dim)', mb: 1.25 }}>
          Ranked by recent frame count. Auto-releases when the process exits.
        </Box>
        {pinnedProcess && (
          <Box
            onClick={() => { closePicker(); unpin(); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.6,
              px: 1, py: 0.6, mb: 1, borderRadius: '6px', cursor: 'pointer',
              border: '1px solid var(--border)', color: 'var(--text-dim)',
              '&:hover': { borderColor: 'var(--error)', color: 'var(--error)' },
            }}
          >
            <CloseIcon sx={{ fontSize: 13 }} />
            <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>Clear pin (back to auto-detect)</Box>
          </Box>
        )}
        {candidatesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={16} sx={{ color: 'var(--text-dim)' }} />
          </Box>
        ) : !candidates || candidates.length === 0 ? (
          <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center', py: 1.5 }}>
            Nothing is presenting frames right now.
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            {candidates.map(c => (
              <Box
                key={c.key}
                onClick={() => pickAndClose(c)}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                  px: 1, py: 0.6, borderRadius: '6px', cursor: 'pointer',
                  opacity: c.excluded ? 0.5 : 1,
                  backgroundColor: c.displayName === pinnedProcess ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${c.displayName === pinnedProcess ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
                  '&:hover': { borderColor: 'var(--accent)' },
                }}
              >
                <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.displayName}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0 }}>
                  <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-dim)' }}>
                    {c.recentFrames}fps
                  </Box>
                  <Box
                    onClick={e => { e.stopPropagation(); toggleExclude(c.key); }}
                    title={c.excluded ? 'Un-exclude (allow auto-detect to track this)' : 'Exclude (never auto-track this)'}
                    sx={{
                      display: 'flex', p: 0.8, m: -0.8, borderRadius: '6px', cursor: 'pointer',
                      color: c.excluded ? 'var(--error)' : 'var(--text-dim)',
                      '&:hover': { color: 'var(--error)', backgroundColor: 'var(--error-dim)' },
                    }}
                  >
                    <BlockIcon sx={{ fontSize: 14 }} />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Popover>

      {capture.ended && capture.summary && (
        <Box sx={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--accent)', borderRadius: '12px', p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              CAPTURE RESULT — {capture.summary.process}
            </Box>
            <Box onClick={clearCapture} sx={{ cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', flexShrink: 0, '&:hover': { color: 'var(--text-primary)' } }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {([['AVG', capture.summary.avgFps, '#f59e0b'], ['1% LOW', capture.summary.low1pct, '#ec4899'], ['0.1% LOW', capture.summary.low01pct, '#a855f7'], ['MIN', capture.summary.minFps, '#10b981'], ['MAX', capture.summary.maxFps, 'var(--text-dim)'], ['HITCHES', capture.summary.hitches, '#fb923c']] as const).map(([l, v, c]) => (
              <Box key={l} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', px: 1.5, py: 0.75, minWidth: 52 }}>
                <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: c }}>{v ?? '—'}</Box>
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)', mt: 0.3 }}>{l}</Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ fontSize: '0.62rem', color: 'var(--text-dim)', mt: 1, fontFamily: 'var(--font-mono)' }}>
            {capture.summary.frames.toLocaleString()} frames · {capture.summary.durationS}s · ended: {capture.summary.endReason}
          </Box>
        </Box>
      )}

      {historyOpen && <CaptureHistoryDialog onClose={() => setHistoryOpen(false)} />}
      {exclusionsOpen && config && (
        <ManageExclusionsDialog
          exclusions={config.processExclusions ?? []}
          onSave={next => updateConfig({ ...config, processExclusions: next })}
          onClose={() => setExclusionsOpen(false)}
        />
      )}
      {newComparisonOpen && <NewComparisonDialog onStart={startComparison} onClose={() => setNewComparisonOpen(false)} />}
      {nextVariantOpen && (
        <NextVariantDialog
          firstVariantLabel={comparison.status.firstVariantLabel}
          firstVariantDurationS={comparison.status.firstVariantDurationS}
          onContinue={continueComparison}
          onClose={() => setNextVariantOpen(false)}
        />
      )}
      {viewComparisonId && <ComparisonViewDialog id={viewComparisonId} onClose={() => setViewComparisonId(null)} />}
    </Box>
  );
}
