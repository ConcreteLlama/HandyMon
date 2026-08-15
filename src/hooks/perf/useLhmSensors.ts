import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import type { LhmSensorGroups } from '@/types/perf';

interface LhmSensorsResponse {
  timestamp: number;
  available: boolean;
  groups: LhmSensorGroups | null;
}

const HISTORY_LENGTH = 60;

// Combined component power (CPU package + GPU package) — the headline number
// for the Power tab. Returns null if neither is present.
export function combinedPowerW(groups: LhmSensorGroups): number | null {
  const cpu = groups.powers.find(p => p.hardwareId.includes('cpu') && p.name === 'Package');
  const gpu = groups.powers.find(p => /^GPU (Package|Power)$/.test(p.name));
  if (cpu === undefined && gpu === undefined) return null;
  return Math.round((cpu?.value ?? 0) + (gpu?.value ?? 0));
}

export function useLhmSensors() {
  const { data } = useQuery<LhmSensorsResponse>({
    queryKey: ['perf', 'lhm-sensors'],
    queryFn: () => apiFetch('/api/perf/lhm-sensors'),
    refetchInterval: 1500,
    gcTime: 0,
    staleTime: 0,
  });
  const latest = data ?? null;

  const [powerHistory, setPowerHistory] = useState<number[]>([]);
  const lastTs = useRef<number>(0);

  useEffect(() => {
    if (!data || !data.groups || data.timestamp === lastTs.current) return;
    lastTs.current = data.timestamp;
    const total = combinedPowerW(data.groups) ?? 0;
    setPowerHistory(prev => {
      const next = [...prev, total];
      return next.length > HISTORY_LENGTH ? next.slice(next.length - HISTORY_LENGTH) : next;
    });
  }, [data]);

  return { latest, powerHistory };
}
