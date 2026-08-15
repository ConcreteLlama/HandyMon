import { apiFetch } from '@/utils/api-client';

export interface UptimeInfo {
  handyMonUptimeSec: number;
  systemBootTimeIso: string | null;
}

export const UptimeApi = {
  get: (): Promise<UptimeInfo> => apiFetch('/api/system/uptime'),
};
