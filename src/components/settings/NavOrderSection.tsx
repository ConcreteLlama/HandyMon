'use client';

import { useState } from 'react';
import { Box } from '@mui/material';
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
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AppConfig } from '@/types/app-config';
import { orderNavItems, type NavItem } from '@/components/nav-items';

function SortableNavRow({ item }: { item: NavItem }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const Icon = item.Icon;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.1, borderRadius: '8px',
        border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)',
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : 'auto', position: 'relative',
      }}
    >
      <Box
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        sx={{ display: 'flex', alignItems: 'center', color: 'var(--text-dim)', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </Box>
      <Icon sx={{ fontSize: 18, color: 'var(--text-secondary)' }} />
      <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.03em', color: 'var(--text-primary)' }}>
        {item.label.toUpperCase()}
      </Box>
    </Box>
  );
}

export function NavOrderSection({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const [items, setItems] = useState<NavItem[]>(() => orderNavItems(config.navOrder));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = [...items];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    setItems(next);
    onSave({ ...config, navOrder: next.map(i => i.id) });
  }

  return (
    <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3 }}>
      <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
        NAVIGATION ORDER
      </Box>
      <Box sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)', mt: 0.25, mb: 2 }}>
        Drag to reorder — the first item becomes your default landing tab
      </Box>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {items.map(item => <SortableNavRow key={item.id} item={item} />)}
          </Box>
        </SortableContext>
      </DndContext>
    </Box>
  );
}

