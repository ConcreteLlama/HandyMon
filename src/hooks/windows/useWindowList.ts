import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import type { WindowInfo } from '@/types/windows';

export function useWindowList() {
  return useQuery({
    queryKey: ['windows', 'list'],
    queryFn: () => apiFetch<WindowInfo[]>('/api/windows/list'),
    refetchInterval: 3000,
    staleTime: 2000,
  });
}
