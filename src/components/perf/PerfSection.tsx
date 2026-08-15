'use client';

import { useState } from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import GridViewIcon from '@mui/icons-material/GridView';
import { useSensorStatus } from '@/hooks/perf/useSensorStatus';
import { usePinnedCards } from '@/hooks/perf/usePinnedCards';
import { usePerfGridMode } from '@/hooks/perf/usePerfGridMode';
import { SwipeableTabs, type SwipeTab } from '../ui/SwipeableTabs';
import { PerfPinProvider } from './PerfPinContext';
import { PerfOverview } from './PerfOverview';
import { CpuChart } from './CpuChart';
import { GpuChart } from './GpuChart';
import { MemoryChart } from './MemoryChart';
import { FrameChart } from './FrameChart';
import { TempsView, PowerView, FansView } from './SensorTabs';
import { DiskIoCard } from './cards/DiskIoCard';
import { NetworkCard } from './cards/NetworkCard';
import { AddCardDialog } from './AddCardDialog';

const TABS = ['OVERVIEW', 'CPU', 'GPU', 'MEMORY', 'FRAME', 'TEMPS', 'POWER', 'FANS', 'DISK', 'NETWORK'] as const;
type TabId = typeof TABS[number];

function getInitialTab(): TabId {
  if (typeof window === 'undefined') return 'OVERVIEW';
  const s = new URLSearchParams(window.location.search).get('perftab');
  return (s && (TABS as readonly string[]).includes(s)) ? s as TabId : 'OVERVIEW';
}

function setTabInUrl(tab: TabId) {
  const params = new URLSearchParams(window.location.search);
  params.set('perftab', tab);
  window.history.replaceState(null, '', `?${params.toString()}`);
}

export function PerfSection() {
  const [tab, setTab]           = useState<TabId>(getInitialTab);
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen]   = useState(false);
  const sensorStatus            = useSensorStatus();
  const { isPinned, toggle, reorder, pinned } = usePinnedCards();
  const { gridContainerRef, canGrid, isGrid, toggleForceSingleColumn } = usePerfGridMode();

  const toggleEdit     = () => setEditMode(v => !v);
  const openAddDialog  = () => setAddOpen(true);

  const changeTab = (v: string) => { setTab(v as TabId); setEditMode(false); setTabInUrl(v as TabId); };

  const tabs: SwipeTab[] = [
    { id: 'OVERVIEW', label: 'OVERVIEW', content: <PerfOverview /> },
    { id: 'CPU',      label: 'CPU',      content: <CpuChart /> },
    { id: 'GPU',      label: 'GPU',      content: <GpuChart /> },
    { id: 'MEMORY',   label: 'MEMORY',   content: <MemoryChart /> },
    { id: 'FRAME',    label: 'FPS',      content: <FrameChart /> },
    { id: 'TEMPS',    label: 'TEMPS',    content: <TempsView /> },
    { id: 'POWER',    label: 'POWER',    content: <PowerView /> },
    { id: 'FANS',     label: 'FANS',     content: <FansView /> },
    { id: 'DISK',     label: 'DISK',     content: <DiskIoCard /> },
    { id: 'NETWORK',  label: 'NETWORK',  content: <NetworkCard /> },
  ];

  // Status line + (on OVERVIEW) the add/edit toolbar, shown between tabs and content.
  const bar = (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
      {/* Sensor (LHM) status is irrelevant on FRAME — that tab shows its own PresentMon status. */}
      {tab !== 'FRAME' ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, backgroundColor: sensorStatus === null ? 'var(--text-dim)' : sensorStatus.available ? '#10b981' : '#f59e0b' }} />
          <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: sensorStatus?.available ? 'var(--text-dim)' : sensorStatus === null ? 'var(--text-dim)' : '#f59e0b' }}>
            {sensorStatus === null
              ? 'checking...'
              : !sensorStatus.available
              ? 'LibreHardwareMonitor not connected — temp, power & clock data unavailable'
              : 'LibreHardwareMonitor connected'}
          </Box>
        </Box>
      ) : <Box />}

      {(tab === 'OVERVIEW' || canGrid) && (
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {/* Grid mode (and this toggle) now applies to every card-grid tab
              (OVERVIEW, CPU, GPU, MEMORY, FPS), not just OVERVIEW — the
              underlying preference is one shared value across all of them,
              so it's shown wherever it'd actually do something. Only shown
              once there's real room for 2 columns — a toggle that could
              never do anything on a phone is just clutter. */}
          {canGrid && (
            <Tooltip title={isGrid ? 'Switch to single column' : 'Switch to 2-column grid'} placement="bottom">
              <ToolbarButton onClick={toggleForceSingleColumn}>
                {isGrid ? <GridViewIcon sx={{ fontSize: '15px !important' }} /> : <ViewAgendaIcon sx={{ fontSize: '15px !important' }} />}
              </ToolbarButton>
            </Tooltip>
          )}
          {/* ADD/EDIT stay OVERVIEW-only — CPU/GPU/MEMORY/FPS show a fixed
              card set, nothing to pin or reorder there. */}
          {tab === 'OVERVIEW' && (
            <>
              <ToolbarButton onClick={openAddDialog} icon={<AddIcon sx={{ fontSize: '13px !important' }} />}>
                ADD
              </ToolbarButton>
              {pinned.length > 0 && (
                <ToolbarButton onClick={toggleEdit} active={editMode}>
                  {editMode ? 'DONE' : 'EDIT'}
                </ToolbarButton>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );

  return (
    <PerfPinProvider value={{ isPinned, toggle, reorder, pinned, editMode, toggleEdit, openAddDialog, gridContainerRef, canGrid, isGrid, toggleForceSingleColumn }}>
      <SwipeableTabs
        tabs={tabs}
        activeId={tab}
        onChange={changeTab}
        bar={bar}
        // Disable swipe while reordering pinned cards so it doesn't fight dnd-kit.
        swipeEnabled={!(tab === 'OVERVIEW' && editMode)}
      />
      <AddCardDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </PerfPinProvider>
  );
}

function ToolbarButton({ children, onClick, active, icon }: { children: React.ReactNode; onClick: () => void; active?: boolean; icon?: React.ReactNode }) {
  return (
    <Button
      onClick={onClick}
      startIcon={icon}
      size="small"
      sx={{
        fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
        color: active ? 'var(--accent)' : 'var(--text-dim)',
        border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)',
        borderRadius: '6px', px: 1.5, py: 0.5, minWidth: 0,
        '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'rgba(255,255,255,0.03)' },
      }}
    >
      {children}
    </Button>
  );
}
