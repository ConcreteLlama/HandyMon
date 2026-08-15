import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/utils/api-client";

export interface SwitchDisplayProfileResult {
  ok: boolean;
  message: string;
  canRetryWithChanges?: boolean;
}

export const useSwitchDisplayProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profile, allowChanges }: { profile: string; allowChanges?: boolean }) =>
      apiFetch<SwitchDisplayProfileResult>(`/api/display/switch?profile=${profile}${allowChanges ? '&allowChanges=true' : ''}`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: ['audio-devices']
  })
  });
};
