'use client';

import { Box } from '@mui/material';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { MiniChart } from '../MiniChart';
import { CardShell, CardTitle, GatheringPlaceholder } from './shared';

export function GpuClocksCard() {
  const { history, latest } = usePerfHistory();

  if (!latest) return (
    <CardShell cardId="gpu-clocks"><CardTitle>GPU CLOCKS</CardTitle><GatheringPlaceholder /></CardShell>
  );
  if (!latest.sensorsAvailable) return (
    <CardShell cardId="gpu-clocks">
      <CardTitle>GPU CLOCKS</CardTitle>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>LibreHardwareMonitor not connected</Box>
    </CardShell>
  );

  return (
    <MiniChart
      label={latest.gpu.coreClockMhz != null
        ? `GPU CLOCKS — Core: ${latest.gpu.coreClockMhz} MHz  Mem: ${latest.gpu.memClockMhz ?? '?'} MHz`
        : 'GPU CLOCKS — —'}
      xData={history.map((_, i) => i)}
      series={[
        { data: history.map(s => s.gpu.coreClockMhz ?? 0), color: '#10b981', label: 'Core' },
        { data: history.map(s => s.gpu.memClockMhz  ?? 0), color: '#8b5cf6', label: 'Mem'  },
      ]}
      yMax={Math.max(500, ...history.map(s => Math.max(s.gpu.coreClockMhz ?? 0, s.gpu.memClockMhz ?? 0))) * 1.1}
      yFormatter={(v: number) => `${v}`}
      cardId="gpu-clocks"
      helpTitle="GPU Clocks"
      help="GPU core and memory clock speeds. Both boost dynamically based on load, temperature, and power limits — low idle values while a game isn't running are normal."
    />
  );
}
