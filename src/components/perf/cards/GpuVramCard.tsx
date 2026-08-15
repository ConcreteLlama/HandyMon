'use client';

import { Box } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { CardShell, CardTitle, GatheringPlaceholder, chartSx, chartFillSx, AXIS_LABEL_COLOR } from './shared';

const VRAM_COLOR = '#8b5cf6';

export function GpuVramCard() {
  const { history, latest } = usePerfHistory();
  const totalVramGb = latest && latest.gpu.totalVramMb > 0 ? Math.ceil(latest.gpu.totalVramMb / 1024) : null;

  return (
    <CardShell cardId="gpu-vram" helpTitle="VRAM" help="Dedicated video memory in use. Games often allocate close to the full amount when available (it's cheap to hold data you might need), so being near the ceiling isn't automatically a problem unless you're also seeing stutters.">
      <CardTitle>
        VRAM — {latest ? `${(latest.gpu.dedicatedVramMb / 1024).toFixed(1)} GB` : '—'}
        {latest && <Box component="span" sx={{ color: 'var(--text-dim)', fontWeight: 400 }}> / {totalVramGb ?? '?'} GB</Box>}
      </CardTitle>
      {!latest ? <GatheringPlaceholder /> : (
        <Box sx={chartFillSx(100)}>
          <LineChart
            xAxis={[{ data: history.map((_, i) => i), scaleType: 'linear', tickNumber: 4, height: 18, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
            yAxis={[{ min: 0, max: totalVramGb ?? 16, width: 30, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${v}G` }]}
            series={[{ data: history.map(s => Math.round(s.gpu.dedicatedVramMb / 1024 * 10) / 10), color: VRAM_COLOR, area: true, showMark: false, label: 'VRAM GB' }]}
            margin={{ top: 10, bottom: 6, left: 4, right: 8 }}
            sx={chartSx}
          />
        </Box>
      )}
    </CardShell>
  );
}
