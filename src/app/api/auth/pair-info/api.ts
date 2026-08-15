import { apiFetch } from '@/utils/api-client';

export interface PairCodeResult {
  qrDataUrl: string;
  pairUrl: string;
  lanIp: string;
  deviceId: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  pairedAt: string;
  lastSeen: string | null;
  grants?: string[]; // undefined = full access
}

export const PairApi = {
  // Create a new device registration and get a QR code
  createPairCode: (name?: string, grants?: string[]): Promise<PairCodeResult> =>
    apiFetch('/api/auth/pair-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, grants }),
    }),

  // List all paired devices (localhost only).
  // Non-localhost callers (e.g. a paired phone) get a 403 — treat that as an
  // empty list (expected/normal, not an error toast) so the query never
  // resolves to undefined.
  listDevices: async (): Promise<PairedDevice[]> => {
    try {
      const d = await apiFetch<{ devices?: PairedDevice[] }>('/api/devices');
      return d.devices ?? [];
    } catch {
      return [];
    }
  },

  deleteDevice: (id: string): Promise<void> => apiFetch(`/api/devices/${id}`, { method: 'DELETE' }),

  // grants: undefined = leave unchanged, null = clear to full access, array = set explicitly
  updateDevice: (id: string, updates: { name?: string; grants?: string[] | null }): Promise<void> =>
    apiFetch(`/api/devices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }),
};
