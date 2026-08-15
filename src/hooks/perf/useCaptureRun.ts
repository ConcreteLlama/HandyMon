import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CaptureRunStatus } from '@/types/perf';
import { apiFetch } from '@/utils/api-client';
import { showToast } from '@/components/ui/Toast';

const KEY = ['perf', 'capture'];

export function useCaptureRun() {
  const qc = useQueryClient();
  const { data } = useQuery<CaptureRunStatus>({
    queryKey: KEY,
    queryFn: () => apiFetch('/api/perf/capture'),
    refetchInterval: 1000,
    gcTime: 0,
    staleTime: 0,
  });
  const status: CaptureRunStatus = data ?? { active: false };

  // Not a useMutation (this hook predates that convention here) — so it
  // doesn't hit the QueryClient's global mutation-error toast automatically;
  // catch and surface explicitly instead.
  const act = async (action: 'start' | 'stop' | 'clear') => {
    try {
      await apiFetch(`/api/perf/capture?action=${action}`, { method: 'POST' });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      qc.invalidateQueries({ queryKey: KEY });
    }
  };

  return {
    status,
    start: () => act('start'),
    stop:  () => act('stop'),
    clear: () => act('clear'),
  };
}
