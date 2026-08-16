'use client';

import { Box, IconButton, Tooltip } from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import { BarChart } from '@mui/x-charts/BarChart';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { usePerfPin } from '../PerfPinContext';
import { CardShell, CardTitle, GatheringPlaceholder, chartSx, chartFillSx, AXIS_LABEL_COLOR, CARD_SX } from './shared';
import { helpProps } from '@/components/help/HelpModeContext';

const CPU_COLOR = '#3b82f6';
const CARD_ID   = 'cpu-cores';

export function CpuCoresCard() {
  const { latest } = usePerfHistory();
  const { isPinned, toggle, editMode } = usePerfPin();
  const pinned = isPinned(CARD_ID);

  if (!latest) return (
    <CardShell cardId={CARD_ID}><CardTitle>CPU PER CORE</CardTitle><GatheringPlaceholder /></CardShell>
  );

  const cores = latest.cpu.cores;
  if (cores.length === 0 || cores.length > 32) return null;

  return (
    <Box
      {...helpProps('Per Core', "Per-logical-core utilization — includes SMT/hyperthreads, so this can show more bars than your CPU's physical core count. A single maxed-out bar while overall usage stays low is the classic signature of a single-threaded bottleneck.")}
      sx={{ ...CARD_SX, p: 0, overflow: 'hidden', position: 'relative' }}
    >
      <Tooltip title={pinned ? 'Unpin from overview' : 'Pin to overview'} placement="left">
        <IconButton
          size="small"
          onClick={() => toggle(CARD_ID)}
          sx={{
            position: 'absolute', top: 6, right: 6, zIndex: editMode ? 20 : 1,
            color: pinned ? 'var(--accent)' : 'var(--text-dim)',
            opacity: editMode ? 1 : (pinned ? 1 : 0.25),
            transition: 'opacity 0.15s, color 0.15s',
            p: 0.75,
            '.MuiBox-root:hover > &, &:focus': { opacity: 1 },
            '& .MuiSvgIcon-root': { fontSize: 18 },
          }}
        >
          {pinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
        </IconButton>
      </Tooltip>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-dim)' }}>
          CPU PER CORE ({cores.length} logical)
        </Box>
      </Box>
      <Box sx={{ px: 2, pb: 2, ...chartFillSx(Math.max(100, Math.min(180, cores.length * 5 + 60))) }}>
        <BarChart
          xAxis={[{ data: cores.map((_, i) => `${i}`), scaleType: 'band', height: 16, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: cores.length > 16 ? 8 : 9 } }]}
          yAxis={[{ min: 0, max: 100, width: 26, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 9 }, valueFormatter: (v: number) => `${v}%`, tickNumber: 3 }]}
          series={[{ data: cores, color: CPU_COLOR, label: 'Core %' }]}
          margin={{ top: 10, bottom: 4, left: 4, right: 6 }}
          sx={chartSx}
          borderRadius={3}
        />
      </Box>
    </Box>
  );
}
