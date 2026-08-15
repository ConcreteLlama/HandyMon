'use client';

import { Box } from '@mui/material';
import { IO_PRIORITY_LEVELS, IO_PRIORITY_LABELS, IoPriorityLevel } from '@/utils/proces-lasso/process-lasso';
import { helpProps } from '@/components/help/HelpModeContext';

export const IO_PRIORITY_COLORS: Record<IoPriorityLevel, string> = {
  0: '#64748b', // very low — muted
  1: '#3b82f6', // low — blue
  2: 'var(--text-dim)', // normal — not worth calling out visually
  3: '#f59e0b', // high — amber
};

export function IoPrioritySelector({ value, onChange }: { value: IoPriorityLevel | null; onChange: (v: IoPriorityLevel | null) => void }) {
  return (
    <Box>
      <Box
        {...helpProps('I/O Priority', "How much priority this process gets for disk/storage access relative to everything else — set LOW for background downloaders or indexers you don't want competing with a game's disk reads, or HIGH for something you always want responsive.")}
        sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', mb: 0.75 }}
      >
        I/O PRIORITY
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {IO_PRIORITY_LEVELS.map(level => (
          <Box
            key={level}
            onClick={() => onChange(value === level ? null : level)}
            sx={{
              px: 1.75, py: 0.7, borderRadius: '8px', cursor: 'pointer',
              border: `1px solid ${value === level ? IO_PRIORITY_COLORS[level] : 'var(--border)'}`,
              backgroundColor: value === level ? `${IO_PRIORITY_COLORS[level]}22` : 'transparent',
              color: value === level ? IO_PRIORITY_COLORS[level] : 'var(--text-secondary)',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.04em',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: IO_PRIORITY_COLORS[level] },
            }}
          >
            {IO_PRIORITY_LABELS[level].toUpperCase()}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
