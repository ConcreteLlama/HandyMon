import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';

// Polled fairly aggressively since the active window changes as fast as the
// user alt-tabs — same idea as useWindowList's polling, just faster since
// this drives a live "which row is active" highlight rather than a list.
export function useActiveWindowPid() {
  return useQuery({
    queryKey: ['windows', 'active'],
    queryFn: () => apiFetch<{ pid: number }>('/api/windows/active'),
    refetchInterval: 1500,
    staleTime: 1000,
    gcTime: 0,
  });
}
