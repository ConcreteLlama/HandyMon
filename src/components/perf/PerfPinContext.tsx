'use client';

import { createContext, useContext } from 'react';

interface PerfPinCtx {
  pinned:         string[];
  editMode:       boolean;
  isPinned:       (id: string) => boolean;
  toggle:         (id: string) => void;
  reorder:        (activeId: string, overId: string) => void;
  toggleEdit:     () => void;
  openAddDialog:  () => void;
  // Grid view mode — see usePerfGridMode.ts for the reasoning. Owned in
  // PerfSection (where the toolbar toggle lives) and threaded down here so
  // PerfOverview can attach gridContainerRef to the element it measures and
  // read isGrid to switch its own layout/dnd-kit sorting strategy. A callback
  // ref, not a RefObject — see usePerfGridMode.ts for why that matters.
  gridContainerRef: (node: HTMLDivElement | null) => void;
  canGrid:          boolean;
  isGrid:           boolean;
  toggleForceSingleColumn: () => void;
}

const PerfPinContext = createContext<PerfPinCtx>({
  pinned:        [],
  editMode:      false,
  isPinned:      () => false,
  toggle:        () => {},
  reorder:       () => {},
  toggleEdit:    () => {},
  openAddDialog: () => {},
  gridContainerRef: () => {},
  canGrid: false,
  isGrid: false,
  toggleForceSingleColumn: () => {},
});

export const usePerfPin      = () => useContext(PerfPinContext);
export const PerfPinProvider = PerfPinContext.Provider;
