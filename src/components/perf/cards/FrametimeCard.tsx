'use client';

import { Box } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useFpsData } from '@/hooks/perf/useFpsData';
import { useAppConfig } from '@/hooks/config/useAppConfig';
import { CardShell, CardTitle, GatheringPlaceholder, chartSx, chartFillSx, AXIS_LABEL_COLOR } from './shared';

const FT_COLOR = '#ef4444';

function FtStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color }}>{value}</Box>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.52rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)' }}>{label}</Box>
    </Box>
  );
}

export function FrametimeCard() {
  const { latest, ftHistory, xData, connected, hasGame, hasFtData } = useFpsData();
  const { data: config } = useAppConfig();
  const windowLabel = config ? ` (last ${config.fpsGraphSeconds}s)` : '';
  const title = `FRAMETIME${windowLabel}`;

  if (!latest) return (
    <CardShell cardId="frametime">
      <CardTitle>{title}</CardTitle>
      <GatheringPlaceholder />
    </CardShell>
  );

  if (!connected) return (
    <CardShell cardId="frametime">
      <CardTitle>{title}</CardTitle>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>PresentMon not capturing</Box>
    </CardShell>
  );

  if (!hasGame) return (
    <CardShell cardId="frametime">
      <CardTitle>{title}</CardTitle>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>
        no active game — launch a game to see frametimes
      </Box>
    </CardShell>
  );

  if (!hasFtData) return (
    <CardShell cardId="frametime">
      <CardTitle>{title}</CardTitle>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>frametime data unavailable</Box>
    </CardShell>
  );

  const valid = ftHistory.filter(v => v > 0);
  const avgFt = valid.length ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length * 100) / 100 : null;
  const maxFt = valid.length ? Math.max(...valid) : null;
  const minFt = valid.length ? Math.min(...valid) : null;

  return (
    <CardShell cardId="frametime" helpTitle="Frametime" help="Milliseconds per frame — the inverse of FPS, but better at showing stutters: a small FPS dip can hide a huge frametime spike that you'd actually feel as a stutter, since FPS is an average over the last second.">
      <CardTitle>{title} — spikes indicate stutters</CardTitle>
      <Box sx={chartFillSx(100)}>
        <LineChart
          skipAnimation
          xAxis={[{ data: xData, scaleType: 'linear', tickNumber: 4, height: 18, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
          yAxis={[{ min: 0, max: Math.max(5, ...valid) * 1.3, width: 36, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${v}ms` }]}
          series={[{ data: ftHistory, color: FT_COLOR, area: true, showMark: false, label: 'ms' }]}
          margin={{ top: 10, bottom: 6, left: 4, right: 8 }}
          sx={chartSx}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 1 }}>
        {avgFt !== null && <FtStat label="AVG"   value={`${avgFt}ms`}            color="var(--text-primary)" />}
        {minFt !== null && <FtStat label="BEST"  value={`${minFt.toFixed(2)}ms`} color="#10b981" />}
        {maxFt !== null && <FtStat label="WORST" value={`${maxFt.toFixed(2)}ms`} color={FT_COLOR} />}
      </Box>
    </CardShell>
  );
}
