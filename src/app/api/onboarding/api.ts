import { apiFetch } from '@/utils/api-client';

export const OnboardingApi = {
  get: () => apiFetch<{ dismissed: Record<string, number> }>('/api/onboarding'),
  dismiss: (versions: Record<string, number>) =>
    apiFetch('/api/onboarding/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versions }),
    }),
};
