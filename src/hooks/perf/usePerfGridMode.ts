import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'perf-force-single-column';
// Shared with every grid's `repeat(auto-fit, minmax(CARD_MIN_WIDTH, 1fr))` —
// the grid flows to however many columns fit at this per-card minimum (1 on
// a phone, 2 on a tablet, 3+ on a wide desktop), no explicit column-count
// logic needed. `auto-fit` (not `auto-fill`) matters here specifically:
// `auto-fill` reserves a track for every column that COULD fit regardless of
// actual item count, so 2 pinned cards on a screen wide enough for 6 columns
// each sat at the bare minimum width with 4 empty phantom tracks eating the
// rest of the row (reported live 2026-08-15). `auto-fit` collapses those
// empty tracks and hands their space back to the real items instead — the
// unbounded `1fr` (no max cap) is deliberate too: an earlier version capped
// at 480px, which on a genuinely wide monitor with only 1-2 cards pinned
// still looked stuck, not actually filling the row (flagged live minutes
// after shipping the capped version).
export const CARD_MIN_WIDTH = 320;
const GRID_GAP = 12; // px, matches the `gap: 1.5` (MUI spacing) used in the grid sx
const GRID_MIN_WIDTH = CARD_MIN_WIDTH * 2 + GRID_GAP;

function loadForceSingleColumn(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function saveForceSingleColumn(v: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
}

// canGrid is driven by the actual rendered width of the pinned-cards
// container (ResizeObserver), not a window-width media query — AppShell's
// own mobile/desktop switch changes available content width unpredictably
// (sidebar appears, padding changes), so measuring the real container is the
// only way to reliably know "is there room for 2 columns" regardless of why.
//
// forceSingleColumn is a per-device opt-out (same category/localStorage
// pattern as theme choice and pinned cards — see theme-storage.ts), not a
// raw column count: canGrid is a hard floor that always wins narrow, so a
// resize/rotation never renders a squeezed 2-up grid just because the
// preference says otherwise.
export function usePerfGridMode() {
  // A plain useRef + a one-shot `useEffect(..., [])` checking `.current` is a
  // classic trap here: on first render the DOM node often isn't attached yet
  // (SwipeableTabs' panel mounts a beat after PerfSection itself), the effect
  // bails out once and — empty deps — never runs again, so canGrid gets
  // stuck false forever (confirmed live 2026-08-14: a 733px-wide container
  // never flipped canGrid despite being well over GRID_MIN_WIDTH). A callback
  // ref re-fires exactly when the node actually mounts, so state setup
  // re-runs at the right time no matter when that happens.
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const gridContainerRef = useCallback((node: HTMLDivElement | null) => setContainerNode(node), []);
  const [canGrid, setCanGrid] = useState(false);
  const [forceSingleColumn, setForceSingleColumn] = useState(loadForceSingleColumn);

  useEffect(() => {
    if (!containerNode) return;
    const observer = new ResizeObserver(entries => {
      setCanGrid((entries[0]?.contentRect.width ?? 0) >= GRID_MIN_WIDTH);
    });
    observer.observe(containerNode);
    return () => observer.disconnect();
  }, [containerNode]);

  const toggleForceSingleColumn = useCallback(() => {
    setForceSingleColumn(prev => {
      const next = !prev;
      saveForceSingleColumn(next);
      return next;
    });
  }, []);

  return { gridContainerRef, canGrid, forceSingleColumn, toggleForceSingleColumn, isGrid: canGrid && !forceSingleColumn };
}
