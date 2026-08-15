'use client';

import { Box } from '@mui/material';
import { usePerfAdvanced } from '@/hooks/perf/usePerfAdvanced';
import { CardShell, CardTitle, GatheringPlaceholder, chartSx, chartFillSx, AXIS_LABEL_COLOR } from './shared';
import { LineChart } from '@mui/x-charts/LineChart';

const READ_COLOR  = '#06b6d4';
const WRITE_COLOR = '#f59e0b';

export function DiskIoCard() {
  const { history, latest } = usePerfAdvanced(true);

  return (
    <CardShell cardId="disk-io" helpTitle="Disk I/O" help="Total read/write throughput across all disks system-wide — not per-drive or per-process. Sustained high numbers during a stutter can point at a storage bottleneck (e.g. loading assets from a slower drive).">
      <CardTitle>DISK I/O</CardTitle>
      {!latest ? <GatheringPlaceholder /> : (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
            {([['READ', latest.disk.readMbps, READ_COLOR], ['WRITE', latest.disk.writeMbps, WRITE_COLOR]] as const).map(([lbl, val, color]) => (
              <Box key={lbl}>
                <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color }}>
                  {val.toFixed(1)}<Box component="span" sx={{ fontSize: '0.65rem', ml: 0.3, color: 'var(--text-dim)' }}>MB/s</Box>
                </Box>
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.52rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)' }}>{lbl}</Box>
              </Box>
            ))}
          </Box>
          {history.length > 1 && (
            <Box sx={chartFillSx(90)}>
              <LineChart
                xAxis={[{ data: history.map((_, i) => i), scaleType: 'linear', tickNumber: 4, height: 18, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
                yAxis={[{ min: 0, max: Math.max(2, ...history.map(s => Math.max(s.disk.readMbps, s.disk.writeMbps))) * 1.2, width: 34, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${v}M` }]}
                series={[
                  { data: history.map(s => s.disk.readMbps),  color: READ_COLOR,  area: true, showMark: false, label: 'Read' },
                  { data: history.map(s => s.disk.writeMbps), color: WRITE_COLOR, area: true, showMark: false, label: 'Write' },
                ]}
                margin={{ top: 10, bottom: 6, left: 4, right: 8 }}
                sx={chartSx}
              />
            </Box>
          )}
        </>
      )}
    </CardShell>
  );
}
