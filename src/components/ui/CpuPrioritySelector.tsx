'use client';

import { Box } from '@mui/material';
import { CPU_PRIORITY_LEVELS, CPU_PRIORITY_LABELS, CpuPriorityLevel } from '@/utils/proces-lasso/process-lasso';
import { helpProps } from '@/components/help/HelpModeContext';

export const CPU_PRIORITY_COLORS: Record<CpuPriorityLevel, string> = {
  idle: '#64748b', // muted
  'below normal': '#3b82f6', // blue
  normal: 'var(--text-dim)', // not worth calling out visually
  'above normal': '#f59e0b', // amber
  high: '#fb923c', // orange
  realtime: '#ef4444', // red — flags how aggressive this setting is
};

export function CpuPrioritySelector({ value, onChange }: { value: CpuPriorityLevel | null; onChange: (v: CpuPriorityLevel | null) => void }) {
  return (
    <Box>
      <Box
        {...helpProps('CPU Priority', "Windows scheduling priority for this process — how much CPU time it gets relative to everything else when cores are contended. REALTIME is aggressive enough to starve other processes (even system ones) and can make a system unresponsive if misused.")}
        sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', mb: 0.75 }}
      >
        CPU PRIORITY
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {CPU_PRIORITY_LEVELS.map(level => (
          <Box
            key={level}
            onClick={() => onChange(value === level ? null : level)}
            sx={{
              px: 1.75, py: 0.7, borderRadius: '8px', cursor: 'pointer',
              border: `1px solid ${value === level ? CPU_PRIORITY_COLORS[level] : 'var(--border)'}`,
              backgroundColor: value === level ? `${CPU_PRIORITY_COLORS[level]}22` : 'transparent',
              color: value === level ? CPU_PRIORITY_COLORS[level] : 'var(--text-secondary)',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.04em',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: CPU_PRIORITY_COLORS[level] },
            }}
          >
            {CPU_PRIORITY_LABELS[level].toUpperCase()}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
