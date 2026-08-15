import { apiFetch } from '@/utils/api-client';

export interface DisplayProfileSummary {
  id: string;
  label: string;
}

export interface DisplayDetail {
  targetId: number;
  name: string;
  connection: string;
  width: number;
  height: number;
  refreshRate: number;
  rotation: string;
  hdrSupported: boolean;
  hdrEnabled: boolean;
  bitsPerColorChannel: number;
}

export const DisplayApi = {
  listProfiles: (): Promise<DisplayProfileSummary[]> =>
    apiFetch<{ profiles: DisplayProfileSummary[] }>('/api/display/profiles').then(d => d.profiles),
  captureProfile: (label: string, excludeTargetIds: number[] = []): Promise<DisplayProfileSummary> =>
    apiFetch<{ ok: boolean; profile: DisplayProfileSummary }>('/api/display/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, excludeTargetIds }),
    }).then(d => d.profile),
  deleteProfile: (id: string): Promise<void> =>
    apiFetch(`/api/display/profiles/${id}`, { method: 'DELETE' }),
  updateProfile: (id: string, excludeTargetIds: number[] = []): Promise<DisplayProfileSummary> =>
    apiFetch<{ ok: boolean; profile: DisplayProfileSummary }>(`/api/display/profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excludeTargetIds }),
    }).then(d => d.profile),
  renameProfile: (id: string, label: string): Promise<DisplayProfileSummary> =>
    apiFetch<{ ok: boolean; profile: DisplayProfileSummary }>(`/api/display/profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    }).then(d => d.profile),
  reorderProfiles: (ids: string[]): Promise<DisplayProfileSummary[]> =>
    apiFetch<{ ok: boolean; profiles: DisplayProfileSummary[] }>('/api/display/profiles/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).then(d => d.profiles),
  getActiveProfileId: (): Promise<string | null> =>
    apiFetch<{ activeId: string | null }>('/api/display/profiles/active').then(d => d.activeId),
  getDetails: (): Promise<DisplayDetail[]> =>
    apiFetch<{ displays: DisplayDetail[] }>('/api/display/details').then(d => d.displays),
  getProfileDetails: (id: string): Promise<DisplayDetail[]> =>
    apiFetch<{ displays: DisplayDetail[] }>(`/api/display/profiles/${id}/details`).then(d => d.displays),
};
