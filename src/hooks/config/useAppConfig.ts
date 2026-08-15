import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { AppConfigApi } from '@/app/api/config/api';
import { DisplayApi } from '@/app/api/display/api';
import { AppConfig } from '@/types/app-config';

const KEY = ['app-config'];

export const useAppConfig = () => useQuery({ queryKey: KEY, queryFn: AppConfigApi.get });

export const useUpdateAppConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: AppConfigApi.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
};

export const DISPLAY_PROFILES_KEY = ['display-profiles'];

export const useDisplayProfiles = () => useQuery({
  queryKey: DISPLAY_PROFILES_KEY,
  queryFn: DisplayApi.listProfiles,
});
