import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';

function closeWindow(body: { pid: number }): Promise<{ ok: boolean; closed: boolean }> {
  return apiFetch('/api/windows/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function useCloseWindow() {
  return useMutation({ mutationFn: closeWindow });
}
