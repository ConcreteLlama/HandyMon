import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import type { Grant } from '@/types/grants';

export interface MyConnection {
  name: string;
  grants: Grant[];
  isLocalhost: boolean;
  userAgent: string;
  ip: string | null;
  pairedAt: string | null;
  lastSeen: string | null;
}

export function useMyConnection() {
  return useQuery<MyConnection>({
    queryKey: ['auth', 'my-connection'],
    queryFn: () => apiFetch('/api/auth/my-connection'),
    staleTime: 30_000,
  });
}
