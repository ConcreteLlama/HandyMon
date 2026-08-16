'use client';

import { Box } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { CardShell, CardTitle, GatheringPlaceholder, chartSx, chartFillSx, AXIS_LABEL_COLOR } from './shared';

const CPU_COLOR = '#3b82f6';

export function CpuUsageCard() {
  const { history, latest } = usePerfHistory();

  return (
    <CardShell cardId="cpu-usage" helpTitle="CPU Usage" help="Overall CPU utilization across all logical cores, averaged. A busy single-threaded game can show low overall usage here even while one core is maxed — see PER CORE for that view.">
      <CardTitle
        action={
          latest && (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              {latest.cpu.packageTempC  != null && <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{latest.cpu.packageTempC}°C</Box>}
              {latest.cpu.packagePowerW != null && <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{latest.cpu.packagePowerW}W</Box>}
            </Box>
          )
        }
      >
        CPU OVERALL — {latest ? `${Math.round(latest.cpu.overall)}%` : '—'}
      </CardTitle>
      {!latest ? <GatheringPlaceholder /> : (
        <Box sx={chartFillSx(100)}>
          <LineChart
            xAxis={[{ data: history.map((_, i) => i), scaleType: 'linear', tickNumber: 4, height: 18, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
            yAxis={[{ min: 0, max: 100, width: 30, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${v}%` }]}
            series={[{ data: history.map(s => s.cpu.overall), color: CPU_COLOR, area: true, showMark: false, label: 'CPU %' }]}
            margin={{ top: 10, bottom: 6, left: 4, right: 8 }}
            sx={chartSx}
          />
        </Box>
      )}
    </CardShell>
  );
}
