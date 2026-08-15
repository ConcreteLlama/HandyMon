import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';

export const useTypeText = () => useMutation({
  mutationFn: (text: string) =>
    apiFetch('/api/keyboard/type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
});

export const useSendKey = () => useMutation({
  mutationFn: (keys: string[]) =>
    apiFetch('/api/keyboard/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    }),
});
