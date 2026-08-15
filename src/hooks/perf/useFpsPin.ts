import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PresentMonCandidate } from '@/utils/presentmon';
import { AppConfigApi } from '@/app/api/config/api';
import { showToast } from '@/components/ui/Toast';

// Candidate list is a snapshot, not a poll — fetched once per picker-open so
// the list stays stable (ranked by recent frame count) while the user is
// choosing, rather than reordering under them the way a live-refreshing list
// would (see the Frame Stats card's own no-reflow layout for why that matters).
export function useFpsPin() {
  const qc = useQueryClient();
  const [candidates, setCandidates] = useState<PresentMonCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadCandidates() {
    setLoading(true);
    try {
      setCandidates(await AppConfigApi.listFpsCandidates());
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to list processes', 'error');
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  function clearCandidates() {
    setCandidates(null);
  }

  async function pin(candidate: PresentMonCandidate) {
    try {
      await AppConfigApi.pinFps(candidate);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to pin', 'error');
    } finally {
      qc.invalidateQueries({ queryKey: ['perf', 'fps'] });
    }
  }

  async function unpin() {
    try {
      await AppConfigApi.unpinFps();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to unpin', 'error');
    } finally {
      qc.invalidateQueries({ queryKey: ['perf', 'fps'] });
    }
  }

  return { candidates, loading, loadCandidates, clearCandidates, pin, unpin };
}
