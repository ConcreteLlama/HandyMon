'use client';

import { Box } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useFpsData } from '@/hooks/perf/useFpsData';
import { useAppConfig } from '@/hooks/config/useAppConfig';
import { CardShell, CardTitle, GatheringPlaceholder, chartSx, chartFillSx, AXIS_LABEL_COLOR } from './shared';

const FPS_COLOR = '#f59e0b';

export function FpsChartCard() {
  const { latest, fpsHistory, xData, connected, hasGame } = useFpsData();
  const { data: config } = useAppConfig();
  // A much shorter rolling window than the Core stat grid's "since reset"
  // scope (see FpsStatsCard) — worth being explicit about, since the two
  // easily get assumed to mean the same timeframe otherwise.
  const title = config ? `FRAMERATE — last ${config.fpsGraphSeconds}s` : 'FRAMERATE';

  if (!latest) return (
    <CardShell cardId="fps-chart">
      <CardTitle>{title}</CardTitle>
      <GatheringPlaceholder />
    </CardShell>
  );

  return (
    <CardShell cardId="fps-chart" helpTitle="Framerate" help="Live FPS over a short rolling window — for the session-wide AVG/lows since your last reset, see the FRAME STATS card instead.">
      <CardTitle>{title}</CardTitle>
      {!connected ? (
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>PresentMon not capturing</Box>
      ) : !hasGame ? (
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>
          no active game — launch a game to see FPS
        </Box>
      ) : (
        <Box sx={chartFillSx(100)}>
          <LineChart
            skipAnimation
            xAxis={[{ data: xData, scaleType: 'linear', tickNumber: 4, height: 18, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
            yAxis={[{ min: 0, max: Math.max(30, ...fpsHistory) * 1.15, width: 26, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${v}` }]}
            series={[{ data: fpsHistory, color: FPS_COLOR, area: true, showMark: false, label: 'FPS' }]}
            margin={{ top: 10, bottom: 6, left: 4, right: 8 }}
            sx={chartSx}
          />
        </Box>
      )}
    </CardShell>
  );
}
