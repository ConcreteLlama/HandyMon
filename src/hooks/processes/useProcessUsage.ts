import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import type { ProcessUsage } from '@/types/processes';

// Map of PID → { cpu%, ram MB }, polled while the Tasks view is open.
export function useProcessUsage() {
  const { data, isLoading } = useQuery({
    queryKey: ['processes', 'usage'],
    queryFn: async (): Promise<Map<number, ProcessUsage>> => {
      const json = await apiFetch<{ usage?: ProcessUsage[] }>('/api/processes/usage');
      const list: ProcessUsage[] = json.usage ?? [];
      return new Map(list.map(u => [u.pid, u]));
    },
    refetchInterval: 2500,
    gcTime: 0,
    staleTime: 0,
  });
  return { data: data ?? new Map<number, ProcessUsage>(), isLoading };
}
