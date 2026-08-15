// Shared fetch wrapper for client-side API calls. The bug this fixes: every
// hand-rolled `fetch(...).then(r => r.json())` call resolves successfully
// even on a 403/500 — the component just gets `{ error: '...' }` back as if
// it were the real payload, so e.g. a permission-denied action silently does
// nothing instead of surfacing an error. apiFetch throws instead, so it
// reaches React Query's onError (see Providers.tsx's MutationCache) and
// shows a toast.
//
// Also the one place every API call funnels through, which is why it's also
// where request signing (see request-signing-client.ts) gets attached —
// every call needs it, so it can't live in individual call sites.
import { signRequest } from './request-signing-client';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// `reason` comes from middleware.ts's VerifyResult (request-signing.ts) on a
// signed-request rejection specifically — distinguishes "clock skew, nothing
// wrong with the pairing" from "signature genuinely doesn't check out,
// re-pair" cases that otherwise looked identical (a bare 401) from here.
function friendlyMessage(raw: string, status: number, reason?: string): string {
  const m = raw.match(/^Missing permission: (.+)$/);
  if (m) return `You don't have permission to do that (${m[1]}).`;
  if (status === 401 && reason === 'expired') {
    return "This device's clock is out of sync with the host PC by more than 5 minutes — fix the time on either device and try again (no need to re-pair).";
  }
  if (status === 401 && reason === 'replay') {
    return 'Request rejected as a duplicate (replay check) — try again.';
  }
  if (status === 401) return 'Not signed in — pair this device again.';
  if (status === 403) return "You don't have permission to do that.";
  return raw || `Request failed (${status})`;
}

export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const signHeaders = await signRequest(init?.method ?? 'GET', url);
  const headers = signHeaders ? { ...(init?.headers as Record<string, string> | undefined), ...signHeaders } : init?.headers;
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let raw = '';
    let reason: string | undefined;
    try {
      const body = await res.json();
      raw = body?.error ?? '';
      reason = body?.reason;
    } catch { /* non-JSON error body */ }
    throw new ApiError(friendlyMessage(raw, res.status, reason), res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
