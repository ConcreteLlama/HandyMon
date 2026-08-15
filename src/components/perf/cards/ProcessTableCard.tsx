'use client';

import { Box } from '@mui/material';
import { usePerfAdvanced } from '@/hooks/perf/usePerfAdvanced';
import { CardShell, CardTitle, GatheringPlaceholder } from './shared';

export function ProcessTableCard() {
  const { latest } = usePerfAdvanced(true);
  const sorted = latest ? [...latest.topProcesses].sort((a, b) => b.cpuPercent - a.cpuPercent) : [];

  return (
    <CardShell cardId="processes">
      <CardTitle>TOP PROCESSES</CardTitle>
      {!latest ? <GatheringPlaceholder /> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '3px 16px', alignItems: 'center' }}>
          {(['PROCESS', 'CPU', 'RAM'] as const).map(h => (
            <Box key={h} sx={{ fontFamily: 'var(--font-display)', fontSize: '0.52rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', pb: 0.5 }}>{h}</Box>
          ))}
          {sorted.map((p, i) => (
            <Box key={i} sx={{ display: 'contents' }}>
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </Box>
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', textAlign: 'right', color: p.cpuPercent > 20 ? '#f59e0b' : 'var(--text-secondary)' }}>
                {p.cpuPercent.toFixed(1)}%
              </Box>
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                {p.ramMb >= 1024 ? `${(p.ramMb / 1024).toFixed(1)}G` : `${p.ramMb}M`}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </CardShell>
  );
}
