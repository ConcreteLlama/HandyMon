'use client';

// TODO: future — explicit grouping so two SMALL cards (e.g. a stat card next
// to another stat card) can share a row even in single-column mode, rather
// than the uniform 1-card-per-cell grid usePerfGridMode() switches to when
// there's room for 2 columns.

import { type ComponentType } from 'react';
import { Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePerfPin } from './PerfPinContext';
import { CARD_MIN_WIDTH } from '@/hooks/perf/usePerfGridMode';
import { CARD_MAP, FPS_CARD_IDS } from './cards/registry';
import { GridCell } from './cards/shared';
import { SensorGroupCard, parseSensorGroupPinId } from './cards/SensorGroupCard';
import { FrameToolbar } from './FrameToolbar';
import { tipProps } from '@/components/onboarding/tips';

// A pinned id is either a static registry entry (CARD_MAP) or a dynamic
// sensor-group id (kind:hardwareId, see SensorGroupCard.tsx) — this is the
// one place that has to know about both, everything downstream just gets a
// plain {id, component} pair either way.
function resolvePinnedCard(id: string): { id: string; component: ComponentType } | null {
  const staticCard = CARD_MAP.get(id);
  if (staticCard) return { id, component: staticCard.component };
  const dynamic = parseSensorGroupPinId(id);
  if (dynamic) return { id, component: () => <SensorGroupCard cardId={id} kind={dynamic.kind} hardwareId={dynamic.hardwareId} /> };
  return null;
}

function SortableCard({ id, component: Card }: { id: string; component: ComponentType }) {
  const { editMode, isGrid } = usePerfPin();
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        position: 'relative',
      }}
    >
      <GridCell isGrid={isGrid}>
        <Card />
      </GridCell>
      {editMode && (
        <>
          {/* Visual dim only — no pointer capture, so the list still scrolls on touch. */}
          <Box sx={{
            position: 'absolute', inset: 0, borderRadius: '12px',
            backgroundColor: 'rgba(13,17,23,0.55)', zIndex: 10, pointerEvents: 'none',
          }} />
          {/* Drag handle — the ONLY draggable area, so touching the card body scrolls. */}
          <Box
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            sx={{
              position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
              px: 2.5, py: 0.75, borderRadius: '8px', zIndex: 11,
              backgroundColor: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)',
              cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none',
              display: 'flex', alignItems: 'center', gap: 0.5,
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.75)', pointerEvents: 'none' }} />
            <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.75)', pointerEvents: 'none' }}>
              DRAG
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

export function PerfOverview() {
  const { pinned, reorder, editMode, openAddDialog, gridContainerRef, isGrid } = usePerfPin();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const pinnedCards = pinned.map(resolvePinnedCard).filter(Boolean);
  const hasFpsCard = pinned.some(id => FPS_CARD_IDS.has(id));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) reorder(String(active.id), String(over.id));
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* Always mounted (even empty-state) so usePerfGridMode's ResizeObserver
          can measure real available width — that's what the toolbar's grid
          toggle visibility depends on, before any card is even pinned. */}
      <Box ref={gridContainerRef} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {pinnedCards.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 6 }}>
            <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'center' }}>
              No cards pinned yet — tap ADD to get started
            </Box>
            <Button
              onClick={openAddDialog}
              startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
              size="small"
              {...tipProps('perf-customize')}
              sx={{
                fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
                color: 'var(--text-dim)', border: '1px dashed', borderColor: 'var(--border)',
                borderRadius: '8px', px: 2, py: 0.75,
                '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'rgba(255,255,255,0.03)' },
              }}
            >
              ADD CARD
            </Button>
          </Box>
        ) : (
          <>
            {hasFpsCard && <FrameToolbar />}
            <SortableContext items={pinned} strategy={isGrid ? rectSortingStrategy : verticalListSortingStrategy}>
              <Box sx={isGrid
                // auto-fit (not auto-fill — see usePerfGridMode.ts) flows to
                // however many CARD_MIN_WIDTH-ish columns fit, and hands
                // unused space to the real cards rather than leaving it in
                // empty phantom tracks — 2 on a tablet, 3-4+ on a wide
                // desktop, each stretching to fill the row regardless of how
                // few cards are actually pinned.
                ? { display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${CARD_MIN_WIDTH}px, 1fr))`, gap: 1.5 }
                : { display: 'flex', flexDirection: 'column', gap: 1.5 }
              }>
                {pinnedCards.map(card => (
                  <SortableCard key={card!.id} id={card!.id} component={card!.component} />
                ))}
              </Box>
            </SortableContext>
          </>
        )}
      </Box>
    </DndContext>
  );
}
