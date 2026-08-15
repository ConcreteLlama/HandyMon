'use client';

import { Box } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { CardShell, CardTitle, GatheringPlaceholder, chartSx, chartFillSx, AXIS_LABEL_COLOR } from './shared';

const GPU_COLOR = '#10b981';

export function GpuUsageCard() {
  const { history, latest } = usePerfHistory();

  return (
    <CardShell cardId="gpu-usage" helpTitle="GPU Usage" help="GPU 3D engine utilization. Low usage with a low framerate usually means you're CPU-bound, not GPU-bound — check GPU BOUND % on the FRAME STATS card.">
      <CardTitle
        action={latest?.gpu.tempC != null
          ? <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{latest.gpu.tempC}°C</Box>
          : undefined
        }
      >
        GPU UTILIZATION — {latest ? `${Math.round(latest.gpu.utilization)}%` : '—'}
      </CardTitle>
      {!latest ? <GatheringPlaceholder /> : (
        <>
          <Box sx={chartFillSx(100)}>
            <LineChart
              xAxis={[{ data: history.map((_, i) => i), scaleType: 'linear', tickNumber: 4, height: 18, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
              yAxis={[{ min: 0, max: 100, width: 30, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${v}%` }]}
              series={[{ data: history.map(s => s.gpu.utilization), color: GPU_COLOR, area: true, showMark: false, label: 'GPU %' }]}
              margin={{ top: 10, bottom: 6, left: 4, right: 8 }}
              sx={chartSx}
            />
          </Box>
          {latest.sensorsAvailable && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              {latest.gpu.powerW       != null && <StatPill label="POWER"    value={`${latest.gpu.powerW}W`} />}
              {latest.gpu.coreClockMhz != null && <StatPill label="CORE CLK" value={`${latest.gpu.coreClockMhz}MHz`} />}
              {latest.gpu.memClockMhz  != null && <StatPill label="MEM CLK"  value={`${latest.gpu.memClockMhz}MHz`} />}
            </Box>
          )}
        </>
      )}
    </CardShell>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', px: 1.5, py: 0.75 }}>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</Box>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', mt: 0.2 }}>{label}</Box>
    </Box>
  );
}
