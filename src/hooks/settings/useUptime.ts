import { useQuery } from '@tanstack/react-query';
import { UptimeApi } from '@/app/api/system/uptime/api';

export function useUptime() {
  return useQuery({
    queryKey: ['system', 'uptime'],
    queryFn: UptimeApi.get,
    refetchInterval: 30_000,
  });
}
