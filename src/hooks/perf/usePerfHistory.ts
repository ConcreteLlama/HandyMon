import { useEffect, useRef, useState } from 'react';
import { usePerfStats } from './usePerfStats';
import type { PerfSnapshot } from '@/types/perf';

const HISTORY_LENGTH = 60;

export const usePerfHistory = () => {
  const { data, isError } = usePerfStats();
  const [history, setHistory] = useState<PerfSnapshot[]>([]);
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
};
