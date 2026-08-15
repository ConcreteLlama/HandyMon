'use client';

import { Box } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { usePerfAdvanced } from '@/hooks/perf/usePerfAdvanced';
import { CardShell, CardTitle, GatheringPlaceholder, chartSx, chartFillSx, AXIS_LABEL_COLOR } from './shared';

const RECV_COLOR = '#ec4899';
const SENT_COLOR = '#8b5cf6';

export function NetworkCard() {
  const { history, latest } = usePerfAdvanced(true);

  return (
    <CardShell cardId="network" helpTitle="Network" help="Total network throughput system-wide, all interfaces and processes combined — not just this dashboard's own traffic.">
      <CardTitle>NETWORK</CardTitle>
      {!latest ? <GatheringPlaceholder /> : (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
            {([['↓ RECV', latest.network.recvMbps, RECV_COLOR], ['↑ SENT', latest.network.sentMbps, SENT_COLOR]] as const).map(([lbl, val, color]) => (
              <Box key={lbl}>
                <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color }}>
                  {val.toFixed(2)}<Box component="span" sx={{ fontSize: '0.65rem', ml: 0.3, color: 'var(--text-dim)' }}>MB/s</Box>
                </Box>
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.52rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)' }}>{lbl}</Box>
              </Box>
            ))}
          </Box>
          {history.length > 1 && (
            <Box sx={chartFillSx(90)}>
              <LineChart
                xAxis={[{ data: history.map((_, i) => i), scaleType: 'linear', tickNumber: 4, height: 18, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
                yAxis={[{ min: 0, max: Math.max(0.1, ...history.map(s => Math.max(s.network.recvMbps, s.network.sentMbps))) * 1.2, width: 34, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${v}M` }]}
                series={[
                  { data: history.map(s => s.network.recvMbps), color: RECV_COLOR, area: true, showMark: false, label: 'Recv' },
                  { data: history.map(s => s.network.sentMbps), color: SENT_COLOR, area: true, showMark: false, label: 'Sent' },
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
