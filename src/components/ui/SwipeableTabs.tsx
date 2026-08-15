'use client';

import {
  useEffect, useLayoutEffect, useRef, useState,
  type ReactNode, type PointerEvent,
} from 'react';
import { Box } from '@mui/material';

export interface SwipeTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface SwipeableTabsProps {
  tabs: SwipeTab[];
  activeId: string;
  onChange: (id: string) => void;
  /** Optional slot rendered between the tab strip and the swipeable panels. */
  bar?: ReactNode;
  /** Set false to disable the swipe gesture (e.g. while a drag-to-reorder is active). Default true. */
  swipeEnabled?: boolean;
}

const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const DURATION = '0.3s';
// Minimum swipe-catch height so short panels still let you swipe the empty area
// below them. Fills the visible screen minus the header/tab-strip/bottom-nav chrome.
const FILL_MIN_HEIGHT = 'calc(100dvh - 210px)';

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Horizontal tab strip with swipeable, height-aware content panels.
 * All panels stay mounted (so each section keeps its own data/fetch lifecycle);
 * only the active one is visible, and the viewport animates to its height.
 */
export function SwipeableTabs({ tabs, activeId, onChange, bar, swipeEnabled = true }: SwipeableTabsProps) {
  const activeIndex = Math.max(0, tabs.findIndex(t => t.id === activeId));

  const viewportRef = useRef<HTMLDivElement>(null);
  const stripRef    = useRef<HTMLDivElement>(null);
  const panelRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const tabRefs     = useRef<(HTMLDivElement | null)[]>([]);

  const [heights, setHeights] = useState<number[]>([]);
  const [drag, setDrag]       = useState<number | null>(null); // live horizontal offset in px

  const dragStart = useRef<{ x: number; y: number; axis: null | 'h' | 'v' } | null>(null);
  const widthRef  = useRef(0);

  // Measure each panel's natural height and keep it live as content loads/changes.
  useIsoLayoutEffect(() => {
    const measure = () => setHeights(panelRefs.current.map(el => el?.offsetHeight ?? 0));
    measure();
    const observers = panelRefs.current.map(el => {
      if (!el) return null;
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return ro;
    });
    return () => observers.forEach(ro => ro?.disconnect());
  }, [tabs.length]);

  // Keep the active tab pill scrolled into view (matters after a swipe).
  useEffect(() => {
    tabRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  const onPointerDown = (e: PointerEvent) => {
    // Ignore secondary mouse buttons; allow mouse/touch/pen primary.
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    // Dialogs opened from within a tab's content (ModalShell, MUI Dialog)
    // render via a portal to document.body — outside the viewport's DOM
    // subtree — but React's synthetic events still bubble through the
    // *component* tree, so without this check a click-drag to select text
    // inside such a dialog would be caught here and treated as a swipe.
    if (viewportRef.current && !viewportRef.current.contains(e.target as Node)) return;
    dragStart.current = { x: e.clientX, y: e.clientY, axis: null };
    widthRef.current = viewportRef.current?.offsetWidth ?? 0;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    // Lock to an axis once the pointer has clearly committed to a direction.
    if (dragStart.current.axis === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      dragStart.current.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      // Keep receiving events even if the pointer leaves the element.
      if (dragStart.current.axis === 'h') {
        try { viewportRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
      }
    }
    if (dragStart.current.axis !== 'h') return; // vertical: let the page scroll

    e.preventDefault(); // suppress mouse text-selection while dragging

    // Rubber-band resistance at the ends.
    const atStart = activeIndex === 0 && dx > 0;
    const atEnd   = activeIndex === tabs.length - 1 && dx < 0;
    setDrag(atStart || atEnd ? dx * 0.35 : dx);
  };

  const endGesture = (e: PointerEvent) => {
    const start = dragStart.current;
    dragStart.current = null;
    try { viewportRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (start?.axis === 'h' && drag !== null) {
      const threshold = Math.min(72, widthRef.current * 0.22);
      if (drag <= -threshold && activeIndex < tabs.length - 1)      onChange(tabs[activeIndex + 1].id);
      else if (drag >= threshold && activeIndex > 0)                onChange(tabs[activeIndex - 1].id);
    }
    setDrag(null);
  };

  const dragging  = drag !== null;
  const width     = widthRef.current || 1;
  const dragPct   = dragging ? (drag / width) * 100 : 0;
  const baseOffset = -activeIndex * 100;

  // While dragging, reserve the taller of the current + revealed neighbour so
  // nothing clips mid-swipe; otherwise snap to the active panel's height.
  let viewportHeight = heights[activeIndex] ?? 0;
  if (dragging && drag !== 0) {
    const neighbour = heights[drag < 0 ? activeIndex + 1 : activeIndex - 1];
    if (neighbour) viewportHeight = Math.max(viewportHeight, neighbour);
  }

  return (
    <Box>
      {/* ── Tab strip ── */}
      <Box sx={{ position: 'relative', mb: 1.5 }}>
        <Box
          ref={stripRef}
          sx={{
            display: 'flex',
            overflowX: 'auto',
            borderBottom: '1px solid var(--border)',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {tabs.map((t, i) => {
            const active = i === activeIndex;
            return (
              <Box
                key={t.id}
                ref={(el: HTMLDivElement | null) => { tabRefs.current[i] = el; }}
                onClick={() => onChange(t.id)}
                // Switching sub-tabs is navigation, not an action — stays
                // clickable in help mode (see HelpOverlay.tsx) same as the
                // main section nav in AppShell.tsx.
                data-help-ignore
                sx={{
                  flexShrink: 0,
                  px: 1.75, py: 1,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  borderBottom: '2px solid',
                  borderColor: active ? 'var(--accent)' : 'transparent',
                  mb: '-1px',
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                  '&:hover': { color: active ? 'var(--accent)' : 'var(--text-secondary)' },
                }}
              >
                {t.label}
              </Box>
            );
          })}
        </Box>
        {/* fade hint that the strip scrolls */}
        <Box sx={{
          position: 'absolute', right: 0, top: 0, bottom: 1, width: 28,
          pointerEvents: 'none',
          background: 'linear-gradient(to right, transparent, var(--bg-base))',
        }} />
      </Box>

      {bar}

      {/* ── Swipeable viewport ── */}
      <Box
        ref={viewportRef}
        onPointerDown={swipeEnabled ? onPointerDown : undefined}
        onPointerMove={swipeEnabled ? onPointerMove : undefined}
        onPointerUp={swipeEnabled ? endGesture : undefined}
        onPointerCancel={swipeEnabled ? endGesture : undefined}
        sx={{
          overflow: 'hidden',
          height: viewportHeight ? `${viewportHeight}px` : 'auto',
          minHeight: FILL_MIN_HEIGHT,
          transition: dragging ? 'none' : `height ${DURATION} ${EASE}`,
          // Let the browser handle vertical scroll; we own horizontal gestures.
          touchAction: swipeEnabled ? 'pan-y' : 'auto',
          userSelect: dragging ? 'none' : 'auto',
        }}
      >
        <Box sx={{
          display: 'flex',
          transform: `translateX(calc(${baseOffset}% + ${dragPct}%))`,
          transition: dragging ? 'none' : `transform ${DURATION} ${EASE}`,
        }}>
          {tabs.map((t, i) => (
            <Box
              key={t.id}
              ref={(el: HTMLDivElement | null) => { panelRefs.current[i] = el; }}
              // aria-hidden keeps off-screen panels out of the a11y tree / tab order
              aria-hidden={i !== activeIndex}
              sx={{ flex: '0 0 100%', alignSelf: 'flex-start', minWidth: 0 }}
            >
              {t.content}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
