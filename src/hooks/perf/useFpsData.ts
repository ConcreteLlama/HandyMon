import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import { useAppConfig } from '@/hooks/config/useAppConfig';

// FPS comes from a dedicated fast endpoint (in-memory PresentMon buffer),
// polled at the configured rate — independent of the slower sensor stats poll.

interface FpsSnapshot {
  timestamp: number;
  fpsAvailable: boolean;
  process: string | null;
  pinnedProcess: string | null;
  gpu: {
    framerateFps:      number | null;
    framerateAvg:      number | null;
    framerate1pctLow:  number | null;
    framerate01pctLow: number | null;
    frameTimeMs:       number | null;
    sessionSeconds:    number | null;
    hitches:           number | null;
    worstHitchMs:      number | null;
    frameTimeStdDevMs: number | null;
    gpuBusyPct:        number | null;
    displayLatencyMs:  number | null;
    inputLatencyMs:    number | null;
    frameGenLikely:        boolean;
    frameGenMultiplierEst: number | null;
    flipMeteringSupported: boolean;
  };
}

const MAX_SAMPLES = 1200; // hard ceiling on rendered points to protect the client

function computeClientAvg(samples: number[]): number | null {
  const v = samples.filter(x => x > 0);
  if (v.length < 5) return null;
  return Math.round(v.reduce((a, x) => a + x, 0) / v.length);
}

function computeClient1pct(samples: number[]): number | null {
  const v = samples.filter(x => x > 0);
  if (v.length < 5) return null;
  const sorted = [...v].sort((a, b) => a - b);
  const bottom = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.01)));
  return Math.round(bottom.reduce((a, x) => a + x, 0) / bottom.length);
}

export function useFpsData() {
  const { data: config } = useAppConfig();
  const pollMs       = config?.fpsPollMs ?? 400;
  const graphSeconds = config?.fpsGraphSeconds ?? 30;
  // Samples needed to cover the requested time window at the current poll rate,
  // capped so a long window + fast poll can't overwhelm chart rendering.
  const historyLength = Math.min(MAX_SAMPLES, Math.max(10, Math.round(graphSeconds * 1000 / pollMs)));

  const { data } = useQuery<FpsSnapshot>({
    queryKey: ['perf', 'fps'],
    queryFn: () => apiFetch('/api/perf/fps'),
    refetchInterval: pollMs,
    gcTime: 0,
    staleTime: 0,
  });
  const latest = data ?? null;

  const [history, setHistory] = useState<FpsSnapshot[]>([]);
  const lastTs = useRef<number>(0);

  useEffect(() => {
    if (!data || data.timestamp === lastTs.current) return;
    lastTs.current = data.timestamp;
    setHistory(prev => {
      const next = [...prev, data];
      return next.length > historyLength ? next.slice(next.length - historyLength) : next;
    });
  }, [data, historyLength]);

  // Clear the client-side chart history when FPS stats are reset.
  useEffect(() => {
    const clear = () => setHistory([]);
    window.addEventListener('perf-reset', clear);
    return () => window.removeEventListener('perf-reset', clear);
  }, []);

  const fps         = latest?.gpu.framerateFps ?? null;
  const ft          = latest?.gpu.frameTimeMs  ?? null;
  const fpsHistory  = history.map(s => s.gpu.framerateFps ?? 0);
  const ftHistory   = history.map(s => s.gpu.frameTimeMs  ?? 0);
  const xData       = history.map((_, i) => i);
  const hasFtData   = ftHistory.some(v => v > 0);

  // avg / lows come from PresentMon (computed server-side).
  const pmAvg    = latest?.gpu.framerateAvg      ?? null;
  const pm1pct   = latest?.gpu.framerate1pctLow  ?? null;
  const pm01pct  = latest?.gpu.framerate01pctLow ?? null;
  const hasStats = pmAvg !== null || pm1pct !== null;

  const displayAvg  = pmAvg  ?? computeClientAvg(fpsHistory);
  const display1pct = pm1pct ?? computeClient1pct(fpsHistory);

  const hitches        = latest?.gpu.hitches ?? null;
  const worstHitch      = latest?.gpu.worstHitchMs ?? null;
  const consistency      = latest?.gpu.frameTimeStdDevMs ?? null;
  const sessionSeconds  = latest?.gpu.sessionSeconds ?? null;
  const gpuBusyPct     = latest?.gpu.gpuBusyPct ?? null;
  const displayLatency = latest?.gpu.displayLatencyMs ?? null;
  const inputLatency   = latest?.gpu.inputLatencyMs ?? null;
  const frameGenLikely  = latest?.gpu.frameGenLikely ?? false;
  const frameGenMultiplierEst = latest?.gpu.frameGenMultiplierEst ?? null;
  const flipMeteringSupported = latest?.gpu.flipMeteringSupported ?? false;
  const process       = latest?.process ?? null;
  const pinnedProcess = latest?.pinnedProcess ?? null;
  const connected     = !!latest?.fpsAvailable;
  const hasGame       = fps !== null && fps > 0;

  return {
    latest, history, fps, ft,
    fpsHistory, ftHistory, xData, hasFtData,
    pmAvg, pm1pct, pm01pct, hasStats, hitches, worstHitch, consistency, sessionSeconds, process, pinnedProcess,
    gpuBusyPct, displayLatency, inputLatency,
    displayAvg, display1pct,
    frameGenLikely, frameGenMultiplierEst, flipMeteringSupported,
    connected, hasGame,
  };
}
