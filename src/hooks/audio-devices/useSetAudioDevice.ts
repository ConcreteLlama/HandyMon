import { AudioDeviceApi } from "@/app/api/audio-devices/api";
import { AudioDeviceActionRequest } from "@/types/audio-devices";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AUDIO_DEVICES_QUERY_KEY } from "./query-keys";

export const usePerformAudioDeviceAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; actions: AudioDeviceActionRequest['actions'] }) =>
      AudioDeviceApi.action(params.id, { actions: params.actions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AUDIO_DEVICES_QUERY_KEY] });
    },
  });
};
