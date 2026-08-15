import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';

function killWindow(body: { pid: number }): Promise<void> {
  return apiFetch('/api/windows/kill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function useKillWindow() {
  return useMutation({ mutationFn: killWindow });
}
