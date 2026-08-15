import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DisplayApi } from '@/app/api/display/api';
import { DISPLAY_PROFILES_KEY } from '@/hooks/config/useAppConfig';

export const useCaptureDisplayProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ label, excludeTargetIds }: { label: string; excludeTargetIds?: number[] }) =>
      DisplayApi.captureProfile(label, excludeTargetIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: DISPLAY_PROFILES_KEY }),
  });
};

export const useDeleteDisplayProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => DisplayApi.deleteProfile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DISPLAY_PROFILES_KEY }),
  });
};

export const useUpdateDisplayProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, excludeTargetIds }: { id: string; excludeTargetIds?: number[] }) =>
      DisplayApi.updateProfile(id, excludeTargetIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: DISPLAY_PROFILES_KEY }),
  });
};

export const useRenameDisplayProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) => DisplayApi.renameProfile(id, label),
    onSuccess: () => qc.invalidateQueries({ queryKey: DISPLAY_PROFILES_KEY }),
  });
};

export const useReorderDisplayProfiles = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => DisplayApi.reorderProfiles(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: DISPLAY_PROFILES_KEY }),
  });
};
