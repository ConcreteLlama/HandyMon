'use client';

import { Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useFpsData } from '@/hooks/perf/useFpsData';
import { DisplayApi } from '@/app/api/display/api';
import { CardShell, CardTitle, GatheringPlaceholder, formatDuration } from './shared';
import { helpProps } from '@/components/help/HelpModeContext';

const FPS_COLOR    = '#f59e0b';
const FT_COLOR     = '#ef4444';
const LOW1_COLOR   = '#ec4899';
const LOW01_COLOR  = '#a855f7';
const HITCH_COLOR  = '#fb923c';
const CONSIST_COLOR = '#10b981';
const GPU_COLOR    = '#22d3ee';
const LAT_COLOR    = '#818cf8';
const ILAT_COLOR   = '#c084fc';
const FG_COLOR     = '#34d399';

// Fallback ceiling for the FPS dial when the display's actual refresh rate
// isn't available (e.g. this device lacks the displayoutput:read grant) —
// otherwise just a guess with no real meaning.
const FPS_RING_MAX_FALLBACK = 240;

function FpsGauge({ fps, ringMax }: { fps: number; ringMax: number }) {
  const r = 36, strokeWidth = 7;
  const circumference = 2 * Math.PI * r;
  const fraction = Math.max(0, Math.min(1, fps / ringMax));
  const dashoffset = circumference * (1 - fraction);
  return (
    <Box
      {...helpProps('FPS gauge', "Fills based on your display's actual refresh rate — not a fixed number. If you're using Frame Generation, NVIDIA Reflex, or a frame-rate limiter, the true max can sit slightly below your display's rate, so the ring reading just short of full at your real ceiling is expected, not a bug.")}
      sx={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}
    >
      <svg width={84} height={84} viewBox="0 0 84 84" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={42} cy={42} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle
          cx={42} cy={42} r={r} fill="none" stroke={FPS_COLOR} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashoffset}
          style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.5))', transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.7rem', fontWeight: 700, color: FPS_COLOR, lineHeight: 1, letterSpacing: '-0.02em' }}>{fps}</Box>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-dim)', mt: 0.25 }}>FPS</Box>
      </Box>
    </Box>
  );
}

// Recent FPS trend, purely decorative — rides beside the hero. Samples
// recorded as 0 (a gap in the client-side history) don't distort the
// y-range; they're drawn back at the vertical midpoint instead of pulling
// the whole line down to zero. The span has a floor proportional to the
// current framerate (not just `max(1, ...)`) — otherwise a rock-solid high
// framerate (e.g. oscillating 115/116) has a span of ~1, which stretches
// that single-frame wobble across the full height and reads as wild
// spiking that isn't really there.
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 140, h = 34;
  const clean = values.filter(v => v > 0);
  if (clean.length < 2) return null;
  const min = Math.min(...clean), max = Math.max(...clean);
  const span = Math.max(max * 0.08, 5, max - min);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = v > 0 ? h - ((v - min) / span) * h : h / 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <Box
      {...helpProps('Trend line', "The recent FPS trend, not the full session — the numbers at top-right/bottom-right are this line's own ceiling and floor, so a rock-solid framerate with only a 1-2fps wobble (e.g. 114-121) doesn't get stretched into looking like a wild spike.")}
      sx={{ position: 'relative', flex: 1, minWidth: 70, height: 34 }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ opacity: 0.55 }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
      </svg>
      {/* Floor/ceiling of what's actually plotted — without these, a rock-
          solid framerate's inherent 1-2fps jitter (now floor-clamped so it
          doesn't fill the whole height, see the `span` floor above) can
          still look like real movement; the numbers make clear whether
          that squiggle spans 5fps or 50fps. */}
      <Box sx={{ position: 'absolute', top: -1, right: 0, fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', lineHeight: 1 }}>
        {Math.round(max)}
      </Box>
      <Box sx={{ position: 'absolute', bottom: -1, right: 0, fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', lineHeight: 1 }}>
        {Math.round(min)}
      </Box>
    </Box>
  );
}

// Every stat — core or situational — gets a permanently reserved grid slot.
// A null value renders as a dim "—" in place rather than the tile
// disappearing, which is what used to make the whole card's flex-wrap
// layout reflow every time a field's availability flickered.
function StatTile({ label, value, unit, color, situational, title, help }: {
  label: string; value: string | number | null; unit?: string; color?: string; situational?: boolean; title?: string; help?: string;
}) {
  const empty = value === null;
  return (
    <Box
      title={title ?? help}
      {...(help ? helpProps(label, help) : {})}
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        borderRadius: '7px', backgroundColor: 'rgba(255,255,255,0.02)', minHeight: 54, px: 0.5, py: 1,
        opacity: empty ? (situational ? 0.55 : 0.5) : 1,
        cursor: title ? 'help' : undefined,
      }}>
      <Box sx={{
        fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, lineHeight: 1,
        color: empty ? 'var(--text-dim)' : (color ?? 'var(--text-primary)'),
        display: 'flex', alignItems: 'baseline', gap: 0.3,
        '@keyframes dimPulse': { '0%, 100%': { opacity: 0.35 }, '50%': { opacity: 0.9 } },
        animation: empty && situational ? 'dimPulse 1.8s ease-in-out infinite' : undefined,
      }}>
        {empty ? '—' : value}
        {!empty && unit && <Box component="span" sx={{ fontSize: '0.55rem', color: 'var(--text-dim)' }}>{unit}</Box>}
      </Box>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.53rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-dim)', mt: 0.5, textAlign: 'center' }}>{label}</Box>
    </Box>
  );
}

export function FpsStatsCard() {
  const {
    latest, fps, ft, fpsHistory, displayAvg, display1pct, pm01pct, hasStats,
    hitches, worstHitch, consistency, sessionSeconds, gpuBusyPct, displayLatency, inputLatency, frameGenLikely, frameGenMultiplierEst, flipMeteringSupported,
    connected, hasGame, pinnedProcess,
  } = useFpsData();

  // Ring "full" = the display's own refresh rate, not an arbitrary number —
  // same query key DisplayControl.tsx uses so they share one cache entry.
  // Falls back to a fixed guess if this device lacks displayoutput:read
  // (a query failure here is silent — no global error toast, see
  // Providers.tsx's MutationCache-only onError — this is a cosmetic nicety,
  // not something worth bothering the user about).
  const { data: displays } = useQuery({
    queryKey: ['display-live-details'],
    queryFn: DisplayApi.getDetails,
    staleTime: 60_000,
    retry: false,
  });
  const ringMax = displays?.length ? Math.max(...displays.map(d => d.refreshRate)) : FPS_RING_MAX_FALLBACK;

  if (!latest) return (
    <CardShell cardId="fps-stats">
      <CardTitle>FRAME STATS</CardTitle>
      <GatheringPlaceholder />
    </CardShell>
  );

  if (!connected) return (
    <CardShell cardId="fps-stats">
      <CardTitle>FRAME STATS</CardTitle>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>PresentMon not capturing</Box>
    </CardShell>
  );

  if (!hasGame) return (
    <CardShell cardId="fps-stats">
      <CardTitle>FRAME STATS</CardTitle>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>
        {pinnedProcess
          ? `tracking ${pinnedProcess} — waiting for frames (loading screen / paused?)`
          : 'no active game — launch a game to see FPS'}
      </Box>
    </CardShell>
  );

  return (
    <CardShell cardId="fps-stats">
      <CardTitle>FRAME STATS</CardTitle>

      {/* Hero: FPS dial + frametime, trend sparkline riding alongside.
          No hard border, and no flat base tint under the gradient either —
          a uniform rgba fill still shows a sharp rectangular edge wherever
          it meets the card's own background, same problem as a border just
          subtler. The radial gradient alone already fades to fully
          transparent well inside the box, so with nothing else filling the
          rest of it there's no edge left to see. */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.25, mb: 1.5, borderRadius: '10px',
        background: 'radial-gradient(140% 140% at 0% 0%, rgba(245,158,11,0.10), transparent 60%)',
      }}>
        <FpsGauge fps={fps ?? 0} ringMax={ringMax} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, flexShrink: 0 }}>
          <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.55rem', fontWeight: 700, color: FT_COLOR, lineHeight: 1 }}>
            {ft !== null ? ft.toFixed(2) : '—'}
            {ft !== null && <Box component="span" sx={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-dim)', ml: 0.4 }}>ms</Box>}
          </Box>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-dim)', mt: 0.3 }}>FRAMETIME</Box>
        </Box>
        <Sparkline values={fpsHistory} color={FPS_COLOR} />
      </Box>

      {/* Core — reliable once a capture is running */}
      <Box sx={{ borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.025)', p: 1, mb: 1 }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase', px: 0.75, pb: 0.75 }}>
          Core{sessionSeconds !== null ? ` — since reset (${formatDuration(sessionSeconds)})` : ''}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
          <StatTile label="AVG"          value={displayAvg}  color="var(--text-secondary)"
            help="Average FPS across the whole session — not just what's on screen right now." />
          <StatTile label="1% LOW"       value={display1pct} color={LOW1_COLOR}
            help="Frame rate of the slowest 1% of frames — the standard 'worst case' metric, since a raw minimum can be thrown off by a single outlier frame." />
          <StatTile label="0.1% LOW"     value={pm01pct}      color={LOW01_COLOR}
            help="Frame rate of the slowest 0.1% of frames — a stricter cut than 1% LOW, closer to catching real stutters." />
          <StatTile label="HITCHES"      value={hitches}      color={HITCH_COLOR}
            help="How many frames took noticeably longer than normal to render this session. What counts as a hitch is tunable via HITCH SENSITIVITY in CONFIG." />
          <StatTile label="WORST HITCH"  value={worstHitch !== null ? worstHitch.toFixed(1) : null} unit="ms" color={HITCH_COLOR}
            help="Frametime of the single worst hitch this session — how long the biggest stutter actually lasted, not just how many there were." />
          <StatTile label="CONSISTENCY"  value={consistency !== null ? consistency.toFixed(2) : null} unit="ms" color={CONSIST_COLOR}
            help="Frame time variation (standard deviation) — lower is smoother pacing. Two sessions can share the same AVG and 1% LOW but feel different if one has steady small variance and the other swings between smooth and juddery." />
          <StatTile label="GPU BOUND"    value={gpuBusyPct}   unit="%" color={GPU_COLOR}
            help="Percent of time the GPU was the bottleneck rather than the CPU. High is normal for a demanding game; unusually low can mean a CPU or driver bottleneck instead." />
        </Box>
      </Box>

      {/* Situational — depends on what the current game/API actually
          reports; absence here is real signal (not every title exposes this
          telemetry), so it's visually quieter and pulses a placeholder
          rather than reading as broken. */}
      <Box sx={{ borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.012)', border: '1px dashed rgba(255,255,255,0.08)', p: 1 }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase', px: 0.75, pb: 0.75 }}>
          Situational — depends on game/API support
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75 }}>
          <StatTile label="LATENCY"   value={displayLatency} unit="ms" color={LAT_COLOR} situational
            help="Time from a frame being rendered by the game to it appearing on screen. Only reported by games/APIs that expose this — dim means this title doesn't report it, not that it's broken." />
          <StatTile label="INPUT LAT" value={inputLatency}   unit="ms" color={ILAT_COLOR} situational
            help="Estimated click-to-photon latency — time from an input event to the resulting frame reaching the screen. Only reported by games/APIs that expose this." />
          <StatTile
            label="FRAME GEN"
            value={frameGenLikely ? (frameGenMultiplierEst ? `~${frameGenMultiplierEst}×${flipMeteringSupported ? '' : '*'}` : 'ON') : null}
            color={FG_COLOR}
            situational
            help={flipMeteringSupported
              ? "Frame generation activity, measured from real flip-metering data (msBetweenDisplayChange) — this PresentMon build reports NVIDIA DLSS4 flip cadence directly, so this reflects true on-screen pacing, not a guess."
              : "Whether frame generation (AI-inserted frames, e.g. DLSS/FSR Frame Generation) looks active, and roughly how many extra frames it's inserting per real one — detected heuristically from frame-timing patterns, since this PresentMon build doesn't report real flip-metering data and most games don't report frame-gen status directly. The * means estimated, not measured."}
          />
        </Box>
      </Box>

      {!hasStats && (
        <Box sx={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-dim)', mt: 1 }}>
          AVG &amp; 1% LOW estimated from recent samples
        </Box>
      )}
    </CardShell>
  );
}
