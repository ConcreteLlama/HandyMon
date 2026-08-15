import { useQuery } from '@tanstack/react-query';
import { ProcessesApi } from '@/app/api/processes/api';

export const useProcessList = () =>
  useQuery({
    queryKey: ['processList'],
    queryFn: ProcessesApi.list,
  });
