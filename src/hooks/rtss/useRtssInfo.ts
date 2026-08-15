import { useQuery } from '@tanstack/react-query';
import { RtssApi } from '@/app/api/rtss/api';

// Whether RTSS is installed at the configured path, so callers can show a
// "not found" state instead of the profile list silently staying empty —
// same pattern as Process Lasso's useProcessLassoInfo.
export function useRtssInfo() {
  const { data } = useQuery({
    queryKey: ['rtss', 'availability'],
    queryFn: () => RtssApi.availability(),
    staleTime: 60_000,
  });
  return { available: data?.available ?? false };
}
