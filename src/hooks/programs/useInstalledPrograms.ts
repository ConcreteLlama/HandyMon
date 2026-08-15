import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import type { InstalledApp } from '@/app/api/programs/list/route';

export function useInstalledPrograms() {
  return useQuery({
    queryKey: ['installed-programs'],
    queryFn: async () => (await apiFetch<{ apps: InstalledApp[] }>('/api/programs/list')).apps,
    staleTime: 5 * 60 * 1000,
  });
}
