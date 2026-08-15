import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import type { SensorSource } from '@/types/perf';

interface SensorStatus {
  available: boolean;
  source: SensorSource | null;
}

export function useSensorStatus() {
  const { data } = useQuery<SensorStatus>({
    queryKey: ['perf', 'sensor-status'],
    queryFn: async () => {
      try {
        return await apiFetch<SensorStatus>('/api/perf/sensors-status');
      } catch {
        return { available: false, source: null };
      }
    },
    refetchInterval: 5000,
    gcTime: 0,
  });
  return data ?? null; // null = still loading
}
