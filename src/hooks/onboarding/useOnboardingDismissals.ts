import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OnboardingApi } from '@/app/api/onboarding/api';

const KEY = ['onboarding'];

export function useOnboardingDismissals(enabled: boolean = true) {
  const qc = useQueryClient();
  const { data, isSuccess } = useQuery({ queryKey: KEY, queryFn: OnboardingApi.get, staleTime: 60_000, enabled });

  const mutation = useMutation({
    mutationFn: (versions: Record<string, number>) => OnboardingApi.dismiss(versions),
    // Optimistic: reflect the dismissal immediately rather than waiting on a
    // round-trip — there's nothing here a failed write should visibly roll
    // back for (worst case, a tip that should be gone reappears next
    // session, not exactly a big loss).
    onMutate: async (versions) => {
      await qc.cancelQueries({ queryKey: KEY });
      qc.setQueryData<{ dismissed: Record<string, number> }>(KEY, (prev) => ({
        dismissed: { ...(prev?.dismissed ?? {}), ...versions },
      }));
    },
  });

  return {
    dismissed: data?.dismissed ?? {},
    // Distinct from "dismissed is {}" — the query hasn't resolved yet either
    // way, so a caller that shows something the instant dismissed is empty
    // (e.g. FirstRunPairDialog) would otherwise flash it on-screen for
    // already-dismissed users too, then yank it back off a moment later once
    // the real data lands.
    loaded: isSuccess,
    dismiss: mutation.mutate,
    // For a caller that navigates away right after dismissing (e.g.
    // FirstRunPairDialog's "Pair device now") — a full page navigation can
    // cancel an in-flight fetch that mutate() merely fired and forgot,
    // reappearing right back on the next page (observed live 2026-08-14).
    // Await this before navigating instead.
    dismissAsync: mutation.mutateAsync,
  };
}
