'use client';

import { Box } from '@mui/material';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { MiniChart } from '../MiniChart';
import { CardShell, CardTitle, GatheringPlaceholder } from './shared';

export function CpuClocksCard() {
  const { history, latest } = usePerfHistory();

  if (!latest) return (
    <CardShell cardId="cpu-clocks"><CardTitle>CPU CLOCKS</CardTitle><GatheringPlaceholder /></CardShell>
  );
  if (!latest.sensorsAvailable) return (
    <CardShell cardId="cpu-clocks">
      <CardTitle>CPU CLOCKS</CardTitle>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 0.5 }}>LibreHardwareMonitor not connected</Box>
    </CardShell>
  );

  return (
    <MiniChart
      label={latest.cpu.avgClockMhz != null
        ? `CPU CLOCKS — Avg: ${latest.cpu.avgClockMhz} MHz  Max: ${latest.cpu.maxClockMhz ?? '?'} MHz`
        : 'CPU CLOCKS — —'}
      xData={history.map((_, i) => i)}
      series={[
        { data: history.map(s => s.cpu.avgClockMhz ?? 0), color: '#3b82f6', label: 'Avg' },
        { data: history.map(s => s.cpu.maxClockMhz ?? 0), color: '#10b981', label: 'Max' },
      ]}
      yMax={Math.max(500, ...history.map(s => Math.max(s.cpu.avgClockMhz ?? 0, s.cpu.maxClockMhz ?? 0))) * 1.1}
      yFormatter={(v: number) => `${v}`}
      cardId="cpu-clocks"
      helpTitle="CPU Clocks"
      help="Effective clock speed — the CPU's real current frequency accounting for idle/low-power states, not the near-static boost target. Avg is across all cores; Max is the single fastest core right now."
    />
  );
}
