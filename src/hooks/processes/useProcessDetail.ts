import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import type { ProcessDetail } from '@/types/processes';

// On-demand richer info for one process (path, command line, threads, uptime).
export function useProcessDetail(pid: number | null) {
  return useQuery({
    queryKey: ['processes', 'detail', pid],
    queryFn: async (): Promise<ProcessDetail | null> => {
      try {
        return await apiFetch<ProcessDetail>(`/api/processes/detail?pid=${pid}`);
      } catch {
        return null;
      }
    },
    enabled: pid !== null,
    gcTime: 0,
    staleTime: 5000,
  });
}
