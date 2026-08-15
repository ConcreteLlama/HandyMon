import { FanControlGetResponseSchema } from "@/types/fan-control";
import { apiFetch } from "@/utils/api-client";

export const FanControlApi = {
    get: () => apiFetch('/api/fan-control').then((value) => FanControlGetResponseSchema.parse(value)),
    setActiveProfile: (profile: string) => apiFetch(`/api/fan-control/${profile}/activate`, { method: 'POST' }),
}