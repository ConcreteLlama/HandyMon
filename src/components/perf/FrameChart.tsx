'use client';

import { Box } from '@mui/material';
import { FrameToolbar } from './FrameToolbar';
import { FpsStatsCard } from './cards/FpsStatsCard';
import { FpsChartCard } from './cards/FpsChartCard';
import { FrametimeCard } from './cards/FrametimeCard';
import { GridCell } from './cards/shared';
import { CARD_MIN_WIDTH } from '@/hooks/perf/usePerfGridMode';
import { usePerfPin } from './PerfPinContext';

export function FrameChart() {
  const { isGrid } = usePerfPin();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <FrameToolbar />
      <Box sx={isGrid
        ? { display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${CARD_MIN_WIDTH}px, 1fr))`, gap: 1.5 }
        : { display: 'flex', flexDirection: 'column', gap: 1.5 }
      }>
        <GridCell isGrid={isGrid}><FpsStatsCard /></GridCell>
        <GridCell isGrid={isGrid}><FpsChartCard /></GridCell>
        <GridCell isGrid={isGrid}><FrametimeCard /></GridCell>
      </Box>
    </Box>
  );
}
