'use client';

import { Box } from '@mui/material';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { usePerfHistory } from '@/hooks/perf/usePerfHistory';
import { CardShell, TITLE_SX, GatheringPlaceholder } from './shared';

const COLORS = { cpu: '#3b82f6', ram: '#f59e0b', gpu: '#10b981', vram: '#8b5cf6' };

function Pills({ items }: { items: { label: string; value: string }[] }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.25 }}>
      {items.map(p => (
        <Box key={p.label} sx={{ display: 'flex', gap: 0.4, alignItems: 'baseline' }}>
          <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{p.value}</Box>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.52rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)' }}>{p.label}</Box>
        </Box>
      ))}
    </Box>
  );
}

function Spark({ data, color, max }: { data: number[]; color: string; max: number }) {
  if (data.length < 2) return null;
  return (
    <Box sx={{ mx: -0.5, mt: 0.25 }}>
      <SparkLineChart data={data} height={44} color={color} area showHighlight={false} showTooltip={false} valueFormatter={() => ''} yAxis={{ min: 0, max }} />
    </Box>
  );
}

export function CpuStatCard() {
  const { history, latest } = usePerfHistory();
  if (!latest) return <CardShell cardId="cpu-stat"><GatheringPlaceholder /></CardShell>;

  const pills = [
    latest.cpu.packageTempC  != null ? { label: 'TEMP',  value: `${latest.cpu.packageTempC}°C`  } : null,
    latest.cpu.packagePowerW != null ? { label: 'POWER', value: `${latest.cpu.packagePowerW}W`  } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <CardShell cardId="cpu-stat" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={TITLE_SX}>CPU</Box>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: COLORS.cpu, lineHeight: 1.1 }}>{Math.round(latest.cpu.overall)}%</Box>
      <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{latest.cpu.cores.length > 0 ? `${latest.cpu.cores.length} logical cores` : 'overall'}</Box>
      {pills.length > 0 && <Pills items={pills} />}
      <Spark data={history.map(s => s.cpu.overall)} color={COLORS.cpu} max={100} />
    </CardShell>
  );
}

export function GpuStatCard() {
  const { history, latest } = usePerfHistory();
  if (!latest) return <CardShell cardId="gpu-stat"><GatheringPlaceholder /></CardShell>;

  const pills = [
    latest.gpu.framerateFps != null ? { label: 'FPS',   value: `${latest.gpu.framerateFps}`      } : null,
    latest.gpu.tempC        != null ? { label: 'TEMP',  value: `${latest.gpu.tempC}°C`             } : null,
    latest.gpu.powerW       != null ? { label: 'POWER', value: `${latest.gpu.powerW}W`             } : null,
    latest.gpu.coreClockMhz != null ? { label: 'CORE',  value: `${latest.gpu.coreClockMhz}MHz`    } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <CardShell cardId="gpu-stat" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={TITLE_SX}>GPU</Box>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: COLORS.gpu, lineHeight: 1.1 }}>{Math.round(latest.gpu.utilization)}%</Box>
      <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>utilization</Box>
      {pills.length > 0 && <Pills items={pills} />}
      <Spark data={history.map(s => s.gpu.utilization)} color={COLORS.gpu} max={100} />
    </CardShell>
  );
}

export function MemStatCard() {
  const { history, latest } = usePerfHistory();
  if (!latest) return <CardShell cardId="mem-stat"><GatheringPlaceholder /></CardShell>;

  const usedGb  = (latest.ram.usedMb  / 1024).toFixed(1);
  const totalGb = (latest.ram.totalMb / 1024).toFixed(1);
  const maxGb   = parseFloat(totalGb) || 32;

  return (
    <CardShell cardId="mem-stat" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={TITLE_SX}>MEMORY</Box>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: COLORS.ram, lineHeight: 1.1 }}>{usedGb} GB</Box>
      <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>of {totalGb} GB</Box>
      <Spark data={history.map(s => s.ram.usedMb / 1024)} color={COLORS.ram} max={maxGb} />
    </CardShell>
  );
}

export function VramStatCard() {
  const { history, latest } = usePerfHistory();
  if (!latest) return <CardShell cardId="vram-stat"><GatheringPlaceholder /></CardShell>;

  const usedGb  = (latest.gpu.dedicatedVramMb / 1024).toFixed(1);
  const totalGb = latest.gpu.totalVramMb > 0 ? (latest.gpu.totalVramMb / 1024).toFixed(0) : '?';
  const maxGb   = latest.gpu.totalVramMb > 0 ? latest.gpu.totalVramMb / 1024 : 16;

  return (
    <CardShell cardId="vram-stat" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={TITLE_SX}>VRAM</Box>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: COLORS.vram, lineHeight: 1.1 }}>{usedGb} GB</Box>
      <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>of {totalGb} GB</Box>
      <Spark data={history.map(s => s.gpu.dedicatedVramMb / 1024)} color={COLORS.vram} max={maxGb} />
    </CardShell>
  );
}
