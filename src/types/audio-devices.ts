import z from "zod";

export type AudioDevice = {
  id: string;
  name: string;
  deviceName: string;
  isDefaultMultimedia: boolean;
  isActive: boolean;
  volumePercent: number | null;
}

export type AudioDeviceResponse = {
    active: AudioDevice | null,
    available: AudioDevice[],
}

export const SetVolumeActionSchema = z.object({
  action: z.literal('set-volume'),
  volume: z.number().min(0).max(100),
});
export type SetVolumeAction = z.infer<typeof SetVolumeActionSchema>;

export const MediaDefaultType = z.enum(['Multimedia']);
export type MediaDefaultType = z.infer<typeof MediaDefaultType>;

export const SetDefaultActionSchema = z.object({
  action: z.literal('set-default'),
  types: MediaDefaultType.array().nonempty(),
});
export type SetDefaultAction = z.infer<typeof SetDefaultActionSchema>;

export const AudioDeviceActionSchema = z.union([
  SetVolumeActionSchema,
  SetDefaultActionSchema,
]);
export type AudioDeviceAction = z.infer<typeof AudioDeviceActionSchema>;

export const AudioDeviceActionRequest = z
  .object({
    actions: z.array(AudioDeviceActionSchema)
      .min(1, 'At least one action is required')
      .refine((actions) => {
        const seen = new Set();
        for (const action of actions) {
          if (seen.has(action.action)) return false;
          seen.add(action.action);
        }
        return true;
      }, { message: 'Duplicate actions are not allowed' }),
  });
export type AudioDeviceActionRequest = z.infer<typeof AudioDeviceActionRequest>;
