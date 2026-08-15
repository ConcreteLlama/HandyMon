'use client';

import { Box } from '@mui/material';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { MiniChart } from '../MiniChart';
import { CardShell, CardTitle, GatheringPlaceholder } from './shared';

export function CpuPowerCard() {
  const { history, latest } = usePerfHistory();

  if (!latest) return (
    <CardShell cardId="cpu-power"><CardTitle>CPU POWER</CardTitle><GatheringPlaceholder /></CardShell>
  );
  if (!latest.sensorsAvailable) return (
    <CardShell cardId="cpu-power">
      <CardTitle>CPU POWER</CardTitle>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>LibreHardwareMonitor not connected</Box>
    </CardShell>
  );

  return (
    <MiniChart
      label={latest.cpu.packagePowerW != null ? `CPU POWER — ${latest.cpu.packagePowerW}W` : 'CPU POWER — —'}
      xData={history.map((_, i) => i)}
      series={[{ data: history.map(s => s.cpu.packagePowerW ?? 0), color: '#f97316', label: 'Power' }]}
      yMax={Math.max(50, ...history.map(s => s.cpu.packagePowerW ?? 0)) * 1.15}
      yFormatter={(v: number) => `${v}W`}
      cardId="cpu-power"
      helpTitle="CPU Power"
      help="CPU package power draw in watts, from LibreHardwareMonitor. This is just the CPU chip — see the Power tab for combined CPU+GPU draw."
    />
  );
}
