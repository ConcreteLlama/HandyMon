import { AudioDevice, AudioDeviceResponse, MediaDefaultType } from '@/types/audio-devices';
import { listRenderDevices, setNativeDefaultEndpoint, setNativeVolume } from './native-audio';

const ROLE_BY_TYPE: Record<MediaDefaultType, number> = {
    Multimedia: 1, // ERole.eMultimedia
};

export const listAudioDevices = async (): Promise<AudioDeviceResponse> => {
    const devices = await listRenderDevices();

    let active: AudioDevice | null = null;
    const available: AudioDevice[] = devices.map(d => {
        const device: AudioDevice = {
            id: d.Id,
            name: d.Name,
            isDefaultMultimedia: d.IsDefault,
            isActive: true, // listRenderDevices already filters to active endpoints
            deviceName: d.DeviceName,
            volumePercent: d.VolumePercent >= 0 ? d.VolumePercent : null,
        };
        if (device.isDefaultMultimedia) active = device;
        return device;
    });

    return { active, available };
};

export const setDefaultAudioDevice = async (id: string, type: MediaDefaultType): Promise<void> => {
    await setNativeDefaultEndpoint(id, ROLE_BY_TYPE[type]);
};

export const setVolume = async (id: string, percent: number): Promise<void> => {
    await setNativeVolume(id, percent);
};
