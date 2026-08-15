import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import type { Grant } from '@/types/grants';

// What the current device is allowed to do — for client-side UI gating
// (hide/disable). Not the security boundary itself; every route re-checks
// via requireGrant() regardless of what this reports.
export function useGrants() {
  const { data } = useQuery<{ grants: Grant[] }>({
    queryKey: ['auth', 'my-grants'],
    queryFn: () => apiFetch('/api/auth/my-grants'),
    staleTime: 60_000,
  });
  const grants = new Set(data?.grants ?? []);
  return { grants, has: (grant: Grant) => grants.has(grant), loaded: !!data };
}
