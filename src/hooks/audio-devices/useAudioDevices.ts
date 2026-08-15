import { AudioDeviceApi } from '@/app/api/audio-devices/api';
import { useQuery } from '@tanstack/react-query';
import { AUDIO_DEVICES_QUERY_KEY } from './query-keys';

export const useAudioDevices = () => {
  return useQuery({
    queryKey: [AUDIO_DEVICES_QUERY_KEY],
    queryFn: () => AudioDeviceApi.list().then((res) => res.devices),
  });
};