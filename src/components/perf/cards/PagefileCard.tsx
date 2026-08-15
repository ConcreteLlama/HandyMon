'use client';

import { Box } from '@mui/material';
import { usePerfAdvanced } from '@/hooks/perf/usePerfAdvanced';
import { CardShell, CardTitle } from './shared';

export function PagefileCard() {
  const { latest } = usePerfAdvanced(true);

  return (
    <CardShell cardId="pagefile" helpTitle="Page File" help="Windows' virtual memory swap file. This filling up on its own isn't a red flag — Windows manages it proactively — but combined with high RAM usage it can indicate memory pressure.">
      <CardTitle>PAGE FILE</CardTitle>
      {!latest ? (
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)' }}>gathering...</Box>
      ) : !latest.pagefile ? (
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)' }}>no pagefile configured</Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5 }}>
          {[
            { label: 'TOTAL', value: `${latest.pagefile.totalMb} MB` },
            { label: 'USED',  value: `${latest.pagefile.usedMb} MB` },
            { label: 'FREE',  value: `${latest.pagefile.totalMb - latest.pagefile.usedMb} MB` },
          ].map(({ label, value }) => (
            <Box key={label}>
              <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.52rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)' }}>{label}</Box>
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', mt: 0.25 }}>{value}</Box>
            </Box>
          ))}
        </Box>
      )}
    </CardShell>
  );
}
