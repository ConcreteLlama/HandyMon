import { useState, useCallback } from 'react';
import { loadPinned, savePinned } from '@/components/perf/cards/registry';

export function usePinnedCards() {
  const [pinned, setPinned] = useState<string[]>(loadPinned);

  const toggle = useCallback((id: string) => {
    setPinned(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      savePinned(next);
      return next;
    });
  }, []);

  const reorder = useCallback((activeId: string, overId: string) => {
    setPinned(prev => {
      const from = prev.indexOf(activeId);
      const to   = prev.indexOf(overId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, activeId);
      savePinned(next);
      return next;
    });
  }, []);

  const isPinned = useCallback((id: string) => pinned.includes(id), [pinned]);

  return { pinned, toggle, reorder, isPinned };
}
