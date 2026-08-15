import { AppConfig } from '@/types/app-config';
import type { PresentMonCandidate } from '@/utils/presentmon';
import { apiFetch } from '@/utils/api-client';

export const AppConfigApi = {
  get: (): Promise<AppConfig> => apiFetch('/api/config'),
  update: (config: AppConfig): Promise<void> =>
    apiFetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }),
  validate: (type: string, p: string): Promise<{ ok: boolean; checkedPath: string }> =>
    apiFetch('/api/config/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, path: p }),
    }),
  testLhm: (port: number): Promise<{ ok: boolean; detail: string }> =>
    apiFetch(`/api/perf/lhm-test?port=${port}`),
  testPresentMon: (p: string): Promise<{ ok: boolean; detail: string }> =>
    apiFetch(`/api/perf/presentmon-test?path=${encodeURIComponent(p)}`),
  debugPresentMon: (): Promise<Record<string, unknown>> =>
    apiFetch('/api/perf/presentmon-debug'),
  resetFps: (): Promise<{ ok: boolean }> =>
    apiFetch('/api/perf/fps-reset', { method: 'POST' }),
  listFpsCandidates: (): Promise<PresentMonCandidate[]> =>
    apiFetch('/api/perf/fps-candidates'),
  pinFps: (candidate: PresentMonCandidate): Promise<{ ok: boolean }> =>
    apiFetch('/api/perf/fps-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: candidate.key, displayName: candidate.displayName, pid: candidate.pid }),
    }),
  unpinFps: (): Promise<{ ok: boolean }> =>
    apiFetch('/api/perf/fps-unpin', { method: 'POST' }),
};
