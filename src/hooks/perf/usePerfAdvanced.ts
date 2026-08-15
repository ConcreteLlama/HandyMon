import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import type { PerfAdvancedSnapshot } from '@/types/perf';

const HISTORY_LENGTH = 60;

export function usePerfAdvanced(enabled = true) {
  const { data, isError } = useQuery<PerfAdvancedSnapshot>({
    queryKey: ['perf', 'advanced'],
    queryFn: () => apiFetch('/api/perf/advanced'),
    enabled,
    refetchInterval: enabled ? 2000 : false,
    gcTime: 0,
  });

  const [history, setHistory] = useState<PerfAdvancedSnapshot[]>([]);
  const lastTimestamp = useRef<number>(0);

  useEffect(() => {
    if (!data || data.timestamp === lastTimestamp.current) return;
    lastTimestamp.current = data.timestamp;
    setHistory(prev => {
      const next = [...prev, data];
      return next.length > HISTORY_LENGTH ? next.slice(next.length - HISTORY_LENGTH) : next;
    });
  }, [data]);

  return { history, latest: data ?? null, isError };
}
