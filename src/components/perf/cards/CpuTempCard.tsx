'use client';

import { Box } from '@mui/material';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { MiniChart } from '../MiniChart';
import { CardShell, CardTitle, GatheringPlaceholder } from './shared';

export function CpuTempCard() {
  const { history, latest } = usePerfHistory();

  if (!latest) return (
    <CardShell cardId="cpu-temp"><CardTitle>CPU TEMP</CardTitle><GatheringPlaceholder /></CardShell>
  );
  if (!latest.sensorsAvailable) return (
    <CardShell cardId="cpu-temp">
      <CardTitle>CPU TEMP</CardTitle>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>LibreHardwareMonitor not connected</Box>
    </CardShell>
  );

  return (
    <MiniChart
      label={latest.cpu.packageTempC != null ? `CPU TEMP — ${latest.cpu.packageTempC}°C` : 'CPU TEMP — —'}
      xData={history.map((_, i) => i)}
      series={[{ data: history.map(s => s.cpu.packageTempC ?? 0), color: '#ef4444', label: 'Temp' }]}
      yMax={105}
      yFormatter={(v: number) => `${v}°`}
      cardId="cpu-temp"
      helpTitle="CPU Temp"
      help="CPU package temperature (Tctl/Tdie) — the hottest point on the die, from LibreHardwareMonitor. Sustained readings near your CPU's thermal limit mean it's throttling clocks to stay safe."
    />
  );
}
