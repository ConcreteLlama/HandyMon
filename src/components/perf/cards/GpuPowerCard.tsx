'use client';

import { Box } from '@mui/material';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { MiniChart } from '../MiniChart';
import { CardShell, CardTitle, GatheringPlaceholder } from './shared';

export function GpuPowerCard() {
  const { history, latest } = usePerfHistory();

  if (!latest) return (
    <CardShell cardId="gpu-power"><CardTitle>GPU POWER</CardTitle><GatheringPlaceholder /></CardShell>
  );
  if (!latest.sensorsAvailable) return (
    <CardShell cardId="gpu-power">
      <CardTitle>GPU POWER</CardTitle>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>LibreHardwareMonitor not connected</Box>
    </CardShell>
  );

  return (
    <MiniChart
      label={latest.gpu.powerW != null ? `GPU POWER — ${latest.gpu.powerW}W` : 'GPU POWER — —'}
      xData={history.map((_, i) => i)}
      series={[{ data: history.map(s => s.gpu.powerW ?? 0), color: '#f97316', label: 'Power' }]}
      yMax={Math.max(100, ...history.map(s => s.gpu.powerW ?? 0)) * 1.15}
      yFormatter={(v: number) => `${v}W`}
      cardId="gpu-power"
      helpTitle="GPU Power"
      help="GPU board power draw in watts, from LibreHardwareMonitor. See the Power tab for combined CPU+GPU draw."
    />
  );
}
