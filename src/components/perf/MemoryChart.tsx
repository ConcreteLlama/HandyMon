'use client';

import { Box } from '@mui/material';
import { MemUsageCard } from './cards/MemUsageCard';
import { PagefileCard } from './cards/PagefileCard';
import { GridCell } from './cards/shared';
import { CARD_MIN_WIDTH } from '@/hooks/perf/usePerfGridMode';
import { usePerfPin } from './PerfPinContext';

export function MemoryChart() {
  const { isGrid } = usePerfPin();
  return (
    <Box sx={isGrid
      ? { display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${CARD_MIN_WIDTH}px, 1fr))`, gap: 2 }
      : { display: 'flex', flexDirection: 'column', gap: 2 }
    }>
      <GridCell isGrid={isGrid}><MemUsageCard /></GridCell>
      <GridCell isGrid={isGrid}><PagefileCard /></GridCell>
    </Box>
  );
}
