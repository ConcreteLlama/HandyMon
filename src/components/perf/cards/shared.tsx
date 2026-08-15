'use client';

import { Box, IconButton, Tooltip } from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import type { ReactNode } from 'react';
import { usePerfPin } from '../PerfPinContext';
import { helpProps } from '@/components/help/HelpModeContext';

export const AXIS_LABEL_COLOR = 'rgba(255,255,255,0.45)';
export const AXIS_COLOR       = 'rgba(255,255,255,0.3)';

export const chartSx = {
  '& .MuiChartsAxis-tickLabel': { fill: AXIS_LABEL_COLOR, fontSize: '0.65rem' },
  '& .MuiChartsAxis-line':      { stroke: AXIS_COLOR },
  '& .MuiChartsAxis-tick':      { stroke: AXIS_COLOR },
  '& .MuiChartsLegend-root':    { display: 'none' },
};

// flex column so a card stretched taller than its own content (grid mode —
// see PerfOverview's SortableCard) has somewhere for that extra height to
// go: a chart wrapped in CHART_FILL_SX below becomes the flex:1 item that
// actually grows into it, rather than the chart sitting at a small fixed
// size with dead space below it (reported live 2026-08-14).
export const CARD_SX = {
  backgroundColor: 'var(--bg-raised)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  p: 2,
  display: 'flex',
  flexDirection: 'column',
} as const;

// Wrap a chart in this — combined with removing its own `height` prop, MUI
// auto-sizes the chart to fill whatever height this box ends up with ("If
// not defined, it takes the height of the parent element" — MUI's own
// useChartDimensions doc comment). minHeight is the floor for when the card
// isn't stretched at all (single-column mode, or every card in the row is
// naturally this short) — without it a flex:1 item can collapse toward 0.
export function chartFillSx(minHeight: number) {
  return { flex: 1, minHeight, display: 'flex', flexDirection: 'column' } as const;
}

export const TITLE_SX = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.62rem',
  fontWeight: 600,
  letterSpacing: '0.1em',
  color: 'var(--text-dim)',
} as const;

// `help`/`helpTitle`, when given, make the WHOLE card a help-mode tap
// target — not just the small title text, which turned out to be too
// small/easy-to-miss a target to feel "implemented" next to FpsStatsCard's
// much larger, individually-outlined stat tiles. One tap anywhere on the
// card (chart included) shows helpTitle/help; the pin button still works
// normally outside help mode since it isn't itself a data-help-title target.
export function CardShell({ children, sx, cardId, help, helpTitle }: { children: ReactNode; sx?: object; cardId?: string; help?: string; helpTitle?: string }) {
  const { isPinned, toggle, editMode } = usePerfPin();
  const pinned = cardId ? isPinned(cardId) : false;

  return (
    <Box sx={{ ...CARD_SX, position: 'relative', ...sx }} {...(help ? helpProps(helpTitle ?? 'Info', help) : {})}>
      {cardId && (
        <Tooltip title={pinned ? 'Unpin from overview' : 'Pin to overview'} placement="left">
          <IconButton
            size="small"
            onClick={() => toggle(cardId)}
            sx={{
              position: 'absolute', top: 6, right: 6,
              zIndex: editMode ? 20 : undefined,
              color: pinned ? 'var(--accent)' : 'var(--text-dim)',
              opacity: editMode ? 1 : (pinned ? 1 : 0.25),
              transition: 'opacity 0.15s, color 0.15s',
              p: 0.75,
              '.MuiBox-root:hover > &, &:focus': { opacity: 1 },
              '& .MuiSvgIcon-root': { fontSize: 18 },
            }}
          >
            {pinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
          </IconButton>
        </Tooltip>
      )}
      {children}
    </Box>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Box sx={TITLE_SX}>{children}</Box>
      {/* The pin button in CardShell is absolutely positioned at right:6,
          spanning ~30px inward (icon + its own padding) — measured from the
          same padding-box edge normal-flow content here extends to, so
          right-aligned action content (e.g. CpuUsageCard's temp/power
          chips) would otherwise sit directly underneath it. Every card
          using this slot is pinnable (CardShell always gets a cardId in
          this registry), so reserving the space unconditionally is safe. */}
      {action && <Box sx={{ pr: '32px' }}>{action}</Box>}
    </Box>
  );
}

// "4m 12s" / "45s" — used anywhere a session-since-reset or capture duration
// needs to be shown, so the timeframe stats cover is never just implicit.
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

export function GatheringPlaceholder() {
  return (
    <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)', py: 2, textAlign: 'center' }}>
      GATHERING...
    </Box>
  );
}

// Shared by every grid of cards (PerfOverview's pinned overview, and the
// fixed CPU/GPU/MEMORY tab lists) — in grid mode, makes a card actually fill
// the row height CSS Grid already stretched its wrapper to (see CARD_SX's
// comment), instead of sitting at its own natural content height inside a
// taller invisible cell. A no-op wrapper outside grid mode, since a
// single-column list has no "row" to match heights against.
export function GridCell({ isGrid, children }: { isGrid: boolean; children: ReactNode }) {
  return (
    <Box sx={isGrid ? { height: '100%', display: 'flex', '& > :first-of-type': { flex: 1, minHeight: 0 } } : undefined}>
      {children}
    </Box>
  );
}

// ── Sensor-group primitives ─────────────────────────────────────────────────
// Shared by SensorTabs.tsx (the Temps/Fans/Power tab views) and
// SensorGroupCard.tsx (the same groups rendered as a pinned Overview card) —
// living here, not in either of those, avoids a circular import between the
// two (SensorGroupCard needs SensorTabs' GroupCard/Row; SensorTabs needs
// SensorGroupCard's pin-id helpers).

export function groupByHardware<T extends { hardware: string }>(readings: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of readings) {
    const arr = m.get(r.hardware);
    if (arr) arr.push(r); else m.set(r.hardware, [r]);
  }
  return m;
}

export function tempColor(v: number): string {
  if (v >= 85) return '#ef4444';
  if (v >= 70) return '#f59e0b';
  if (v >= 55) return '#eab308';
  return '#10b981';
}

// cardId, when given, makes the whole group pinnable to Overview (see
// SensorGroupCard.tsx) — every call site passes one, so a group can always
// be pinned straight from wherever you're already looking at it.
export function GroupCard({ title, cardId, children }: { title: string; cardId?: string; children: ReactNode }) {
  return (
    <CardShell cardId={cardId}>
      <Box sx={{ ...TITLE_SX, mb: 1 }}>{title.toUpperCase()}</Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>{children}</Box>
    </CardShell>
  );
}

export function Row({ label, value, unit, color, dim }: { label: string; value: string; unit: string; color?: string; dim?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', py: 0.35, opacity: dim ? 0.45 : 1, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{label}</Box>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.86rem', fontWeight: 700, color: color ?? 'var(--text-primary)' }}>
        {value}<Box component="span" sx={{ fontSize: '0.6rem', ml: 0.3, color: 'var(--text-dim)', fontWeight: 400 }}>{unit}</Box>
      </Box>
    </Box>
  );
}
