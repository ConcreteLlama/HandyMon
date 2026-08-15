'use client';

import { Box } from '@mui/material';
import { GpuUsageCard } from './cards/GpuUsageCard';
import { GpuVramCard } from './cards/GpuVramCard';
import { GpuTempCard } from './cards/GpuTempCard';
import { GpuPowerCard } from './cards/GpuPowerCard';
import { GpuClocksCard } from './cards/GpuClocksCard';
import { GridCell } from './cards/shared';
import { CARD_MIN_WIDTH } from '@/hooks/perf/usePerfGridMode';
import { usePerfPin } from './PerfPinContext';

export function GpuChart() {
  const { isGrid } = usePerfPin();
  return (
    <Box sx={isGrid
      ? { display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${CARD_MIN_WIDTH}px, 1fr))`, gap: 2 }
      : { display: 'flex', flexDirection: 'column', gap: 2 }
    }>
      <GridCell isGrid={isGrid}><GpuUsageCard /></GridCell>
      <GridCell isGrid={isGrid}><GpuVramCard /></GridCell>
      <GridCell isGrid={isGrid}><GpuTempCard /></GridCell>
      <GridCell isGrid={isGrid}><GpuPowerCard /></GridCell>
      <GridCell isGrid={isGrid}><GpuClocksCard /></GridCell>
    </Box>
  );
}
