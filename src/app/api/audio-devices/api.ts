import { AudioDeviceActionRequest, AudioDeviceResponse } from "@/types/audio-devices";
import { apiFetch } from "@/utils/api-client";

export const AudioDeviceApi = {
            list: () => apiFetch<{ devices: AudioDeviceResponse }>(`/api/audio-devices`),
            action: (deviceId: string, actionRequest: AudioDeviceActionRequest) =>
                apiFetch(`/api/audio-devices/${deviceId}/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(actionRequest),
                }),
}