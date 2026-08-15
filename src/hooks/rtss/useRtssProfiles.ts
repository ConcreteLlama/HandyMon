import { useQuery } from '@tanstack/react-query';
import { RtssApi } from '@/app/api/rtss/api';

export const useRtssProfiles = () =>
  useQuery({
    queryKey: ['rtssProfiles'],
    queryFn: RtssApi.profiles.list,
  });
