'use client';

import { Box } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { CardShell, CardTitle, GatheringPlaceholder, chartSx, chartFillSx, AXIS_LABEL_COLOR } from './shared';

const RAM_COLOR = '#f59e0b';

export function MemUsageCard() {
  const { history, latest } = usePerfHistory();

  const totalGb = latest ? latest.ram.totalMb / 1024 : null;
  const usedGb  = latest ? (latest.ram.usedMb / 1024).toFixed(1) : null;
  const freeGb  = latest ? ((latest.ram.totalMb - latest.ram.usedMb) / 1024).toFixed(1) : null;
  const usedPct = latest ? Math.round((latest.ram.usedMb / latest.ram.totalMb) * 100) : null;

  return (
    <CardShell cardId="mem-usage" helpTitle="RAM Usage" help="System memory currently in use by all running processes combined. Windows also uses free RAM for disk caching, so usage can look higher than what your apps actually need — that cache is released instantly if an app requests more memory.">
      <CardTitle>
        RAM USAGE — {usedGb ? `${usedGb} GB (${usedPct}%)` : '—'}
        {freeGb && <Box component="span" sx={{ ml: 1.5, color: 'var(--text-secondary)', fontWeight: 400 }}>{freeGb} GB free</Box>}
      </CardTitle>
      {!latest ? <GatheringPlaceholder /> : (
        <>
          <Box sx={chartFillSx(110)}>
            <LineChart
              xAxis={[{ data: history.map((_, i) => i), scaleType: 'linear', tickNumber: 4, height: 18, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
              yAxis={[{ min: 0, max: Math.ceil(totalGb!), width: 30, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${v}G` }]}
              series={[{ data: history.map(s => Math.round(s.ram.usedMb / 1024 * 10) / 10), color: RAM_COLOR, area: true, showMark: false, label: 'RAM GB' }]}
              margin={{ top: 10, bottom: 6, left: 4, right: 8 }}
              sx={chartSx}
            />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1.5 }}>
            {[
              { label: 'TOTAL', value: `${totalGb!.toFixed(1)} GB` },
              { label: 'USED',  value: `${usedGb} GB` },
              { label: 'FREE',  value: `${freeGb} GB` },
              { label: 'USAGE', value: `${usedPct}%` },
            ].map(({ label, value }) => (
              <Box key={label} sx={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '10px', p: 1.5 }}>
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-dim)' }}>{label}</Box>
                <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: RAM_COLOR, mt: 0.25 }}>{value}</Box>
              </Box>
            ))}
          </Box>
        </>
      )}
    </CardShell>
  );
}
