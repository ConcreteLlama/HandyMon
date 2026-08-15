import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';

function focusWindow(body: { pid: number }): Promise<void> {
  return apiFetch('/api/windows/focus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function useFocusWindow() {
  return useMutation({ mutationFn: focusWindow });
}
