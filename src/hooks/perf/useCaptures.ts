import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CaptureFileInfo, CaptureRunSummary, CaptureSeriesPoint, CaptureSensorSample } from '@/types/perf';
import { apiFetch } from '@/utils/api-client';
import { showToast } from '@/components/ui/Toast';

export function useCaptures() {
  const qc = useQueryClient();
  const { data } = useQuery<{ captures: CaptureFileInfo[] }>({
    queryKey: ['perf', 'captures'],
    queryFn: () => apiFetch('/api/perf/captures'),
    gcTime: 0,
    staleTime: 0,
  });
  const { data: cfx } = useQuery<{ available: boolean }>({
    queryKey: ['perf', 'capframex-available'],
    queryFn: () => apiFetch('/api/perf/captures/open'),
    staleTime: 60_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['perf', 'captures'] });
  const remove = async (file: string) => {
    try {
      await apiFetch(`/api/perf/captures?file=${encodeURIComponent(file)}`, { method: 'DELETE' });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      refresh();
    }
  };
  const openInCapFrameX = async (file: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      return await apiFetch(`/api/perf/captures/open?file=${encodeURIComponent(file)}`, { method: 'POST' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed';
      showToast(message, 'error');
      return { ok: false, error: message };
    }
  };

  return { captures: data?.captures ?? [], capFrameXAvailable: !!cfx?.available, refresh, remove, openInCapFrameX };
}

export async function fetchCaptureData(file: string): Promise<{ summary: CaptureRunSummary | null; series: CaptureSeriesPoint[]; hitchTimes: number[]; sensors: CaptureSensorSample[] } | null> {
  try {
    return await apiFetch(`/api/perf/captures?file=${encodeURIComponent(file)}`);
  } catch {
    return null;
  }
}
