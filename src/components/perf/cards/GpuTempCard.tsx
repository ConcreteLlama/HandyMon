'use client';

import { Box } from '@mui/material';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { MiniChart } from '../MiniChart';
import { CardShell, CardTitle, GatheringPlaceholder } from './shared';

export function GpuTempCard() {
  const { history, latest } = usePerfHistory();

  if (!latest) return (
    <CardShell cardId="gpu-temp"><CardTitle>GPU TEMP</CardTitle><GatheringPlaceholder /></CardShell>
  );
  if (!latest.sensorsAvailable) return (
    <CardShell cardId="gpu-temp">
      <CardTitle>GPU TEMP</CardTitle>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>LibreHardwareMonitor not connected</Box>
    </CardShell>
  );

  return (
    <MiniChart
      label={latest.gpu.tempC != null ? `GPU TEMP — ${latest.gpu.tempC}°C` : 'GPU TEMP — —'}
      xData={history.map((_, i) => i)}
      series={[{ data: history.map(s => s.gpu.tempC ?? 0), color: '#ef4444', label: 'Temp' }]}
      yMax={100}
      yFormatter={(v: number) => `${v}°`}
      cardId="gpu-temp"
      helpTitle="GPU Temp"
      help="GPU core temperature, from LibreHardwareMonitor. Modern GPUs are designed to run hot under load (often 70-85°C) — that alone isn't a problem unless it's sustained near your card's throttle point."
    />
  );
}
