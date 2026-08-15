import { apiFetch } from "@/utils/api-client";

export const copyRtssProfileAPICall = (from: string, to: string) =>
  apiFetch(`/api/rtss/profiles/${from}/copy?to=${to}`, { method: 'POST' });