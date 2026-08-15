import { PartialRtssConfig, RtssConfig } from "@/types/rtss";
import { apiFetch } from "@/utils/api-client";

export const setRtssConfigApiCall = (profile: string, config: RtssConfig) =>
    apiFetch<{ config: RtssConfig }>(`/api/rtss/profiles/${profile}/config`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
    });

export const patchRtssConfigApiCall = (profile: string, config: PartialRtssConfig) =>
    apiFetch<{ updatedConfig: RtssConfig }>(`/api/rtss/profiles/${profile}/config`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
    });

export const getRtssConfigApiCall = (profile: string) =>
    apiFetch<{ config: RtssConfig }>(`/api/rtss/profiles/${profile}/config`);
