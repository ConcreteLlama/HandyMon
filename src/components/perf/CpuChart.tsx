'use client';

import { Box } from '@mui/material';
import { CpuUsageCard } from './cards/CpuUsageCard';
import { CpuCoresCard } from './cards/CpuCoresCard';
import { CpuTempCard } from './cards/CpuTempCard';
import { CpuPowerCard } from './cards/CpuPowerCard';
import { CpuClocksCard } from './cards/CpuClocksCard';
import { GridCell } from './cards/shared';
import { CARD_MIN_WIDTH } from '@/hooks/perf/usePerfGridMode';
import { usePerfPin } from './PerfPinContext';

// No drag-reorder here (fixed card set, unlike Overview's pinned list), so
// this reuses the same isGrid decision from context but skips dnd-kit
// entirely — just the grid CSS + GridCell's height-fill treatment.
export function CpuChart() {
  const { isGrid } = usePerfPin();
  return (
    <Box sx={isGrid
      ? { display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${CARD_MIN_WIDTH}px, 1fr))`, gap: 2 }
      : { display: 'flex', flexDirection: 'column', gap: 2 }
    }>
      <GridCell isGrid={isGrid}><CpuUsageCard /></GridCell>
      <GridCell isGrid={isGrid}><CpuCoresCard /></GridCell>
      <GridCell isGrid={isGrid}><CpuTempCard /></GridCell>
      <GridCell isGrid={isGrid}><CpuPowerCard /></GridCell>
      <GridCell isGrid={isGrid}><CpuClocksCard /></GridCell>
    </Box>
  );
}
