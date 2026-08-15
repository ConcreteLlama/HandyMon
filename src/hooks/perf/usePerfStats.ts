import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import type { PerfSnapshot } from '@/types/perf';

export const usePerfStats = () =>
  useQuery<PerfSnapshot>({
    queryKey: ['perf', 'stats'],
    queryFn: () => apiFetch('/api/perf/stats'),
    refetchInterval: 1500,
    gcTime: 0,
    staleTime: 0,
  });
