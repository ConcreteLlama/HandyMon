import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ComparisonRunStatus, ComparisonListItem, ComparisonManifest, CaptureRunSummary, CaptureSeriesPoint, CaptureSensorSample } from '@/types/perf';
import { apiFetch } from '@/utils/api-client';
import { showToast } from '@/components/ui/Toast';

const RUN_KEY = ['perf', 'comparison'];

// Live comparison in progress — mirrors useCaptureRun.ts's shape.
export function useComparisonRun() {
  const qc = useQueryClient();
  const { data } = useQuery<ComparisonRunStatus>({
    queryKey: RUN_KEY,
    queryFn: () => apiFetch('/api/perf/comparison'),
    refetchInterval: 1000,
    gcTime: 0,
    staleTime: 0,
  });
  const status: ComparisonRunStatus = data ?? { active: false };

  const post = async (action: 'start' | 'pause' | 'continue' | 'finish', body?: { label?: string; variantLabel?: string; matchFirstDuration?: boolean }) => {
    try {
      return await apiFetch<ComparisonRunStatus & { finishedId?: string }>(`/api/perf/comparison?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
      return null;
    } finally {
      qc.invalidateQueries({ queryKey: RUN_KEY });
    }
  };

  return {
    status,
    start: (comparisonLabel?: string, firstVariantLabel?: string) => post('start', { label: comparisonLabel, variantLabel: firstVariantLabel }),
    pause: () => post('pause'),
    // `label` here is the NEXT variant's label, prompted for right before resuming.
    continueWith: (nextVariantLabel?: string, matchFirstDuration?: boolean) => post('continue', { label: nextVariantLabel, matchFirstDuration }),
    // Resolves with `finishedId` set — lets the caller open that comparison's viewer directly.
    finish: () => post('finish'),
  };
}

// History — mirrors useCaptures.ts's shape.
export function useComparisons() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ comparisons: ComparisonListItem[] }>({
    queryKey: ['perf', 'comparisons'],
    queryFn: () => apiFetch('/api/perf/comparisons'),
    gcTime: 0,
    staleTime: 0,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['perf', 'comparisons'] });
  const remove = async (id: string) => {
    try {
      await apiFetch(`/api/perf/comparisons?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      refresh();
    }
  };

  // isLoading, not just data-is-undefined — without this, "0 comparisons"
  // (still fetching) and "0 comparisons" (genuinely empty) render identically.
  return { comparisons: data?.comparisons ?? [], isLoading, refresh, remove };
}

// Region selector (Phase 2) — persists a variant's picked window and
// returns its recomputed windowed summary; caller is responsible for
// invalidating/refetching the comparison-data query afterward.
export async function setComparisonVariantRegion(id: string, variantBase: string, start: number, end: number): Promise<{ ok: boolean; error?: string; summary?: CaptureRunSummary | null }> {
  try {
    return await apiFetch(`/api/perf/comparisons?id=${encodeURIComponent(id)}&action=set-region`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantBase, start, end }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    showToast(message, 'error');
    return { ok: false, error: message };
  }
}

// Builds a Comparison out of existing standalone captures (not the live
// record-variants-in-sequence flow) — caller is responsible for refreshing
// the comparisons list afterward and can jump straight to the returned id's
// viewer, mirroring how finishing a live comparison works.
export async function createComparisonFromCaptures(label: string | undefined, items: { file: string; label?: string }[]): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    return await apiFetch('/api/perf/comparisons?action=create-from-captures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, captures: items }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    showToast(message, 'error');
    return { ok: false, error: message };
  }
}

export type ComparisonData = ComparisonManifest & {
  variantData: ({ summary: CaptureRunSummary | null; series: CaptureSeriesPoint[]; hitchTimes: number[]; sensors: CaptureSensorSample[] } | null)[];
};

export async function fetchComparisonData(id: string): Promise<ComparisonData | null> {
  try {
    return await apiFetch(`/api/perf/comparisons?id=${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}
