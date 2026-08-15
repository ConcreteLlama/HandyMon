'use client';

import { AppThemeProvider } from './ThemeContext';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { ToastHost, showToast } from './ui/Toast';
import { ApiError } from '@/utils/api-client';
import { HelpModeProvider } from './help/HelpModeContext';
import { HelpOverlay } from './help/HelpOverlay';
import { OnboardingOverlay } from './onboarding/OnboardingOverlay';
import { FirstRunPairDialog } from './onboarding/FirstRunPairDialog';

export const Providers = ({ children }: { children: ReactNode }) => {
  // Global net: any useMutation whose mutationFn throws (apiFetch, or any
  // hand-thrown Error) surfaces here automatically — no per-component wiring
  // needed. This is what makes a 403/permission-denied action visible instead
  // of silently no-op'ing.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // React Query's own default (retry: 3, exponential backoff) is fine
        // for a transient failure (brief network drop, a momentary 500) —
        // but a 401/403 is deterministic, not transient: a clock-skew
        // signature rejection or a missing grant will fail exactly the same
        // way on every retry, since nothing about the request changes
        // between attempts. Retrying those just delays the user actually
        // finding out — ~1s+2s+4s of silent backoff before the query
        // "settles" into an error and the QueryCache.onError below even
        // fires (confirmed live: a clock-skew toast took 5-10s to appear).
        // Fail fast on those two specifically, keep the default elsewhere.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
          return failureCount < 3;
        },
      },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        const message = error instanceof ApiError ? error.message
          : error instanceof Error ? error.message
          : 'Something went wrong';
        showToast(message, 'error');
      },
    }),
    // Deliberately narrower than the mutation net above: most of the app is
    // useQuery (perf stats, sensors, profiles, grants...), several polling
    // every second or faster, so toasting on every query error would spam
    // (a genuine network blip on a phone would otherwise fire a toast per
    // failed poll, across every concurrently-polling query). Scoped to 401s
    // specifically — a device that's lost API access (clock skew, revoked
    // pairing) needs to know clearly and immediately, per the "half-loaded,
    // looks broken but nothing says why" gap this closes; anything else
    // failing transiently just retries quietly, same as before. ToastHost is
    // a single-slot toast (not a queue), so a burst of near-simultaneous
    // 401s across many queries — which is exactly what a clock-skew reject
    // looks like — just keeps the same message visible rather than stacking.
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) {
          showToast(error.message, 'error');
        }
      },
    }),
  }));

  return <QueryClientProvider client={queryClient}>
    <AppThemeProvider>
      <HelpModeProvider>
        {children}
        <HelpOverlay />
        <OnboardingOverlay />
        <FirstRunPairDialog />
      </HelpModeProvider>
      <ToastHost />
    </AppThemeProvider>
  </QueryClientProvider>;
};
