import { useQuery } from '@tanstack/react-query';
import { ProcessLassoApi } from '@/app/api/process-lasso/api';

// Whether Process Lasso's config file is present, so callers can hide CPU-set
// assignment UI when it isn't installed/configured. Also exposes the host's
// logical core count, needed to render the CPU core picker.
export function useProcessLassoInfo() {
  const { data } = useQuery({
    queryKey: ['process-lasso', 'availability'],
    queryFn: () => ProcessLassoApi.availability(),
    staleTime: 60_000,
  });
  return { available: data?.available ?? false, coreCount: data?.coreCount ?? 0 };
}
