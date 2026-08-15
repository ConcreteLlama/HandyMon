'use client';

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useLhmSensors, combinedPowerW } from '@/hooks/perf/useLhmSensors';
import type { LhmReading } from '@/types/perf';
import { CARD_SX, TITLE_SX, GatheringPlaceholder, chartSx, chartFillSx, AXIS_LABEL_COLOR, groupByHardware, tempColor, GroupCard, Row } from './cards/shared';
import { sensorGroupPinId } from './cards/SensorGroupCard';

function NotConnected() {
  return (
    <Box sx={CARD_SX}>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--warning)', py: 1, textAlign: 'center' }}>
        LibreHardwareMonitor not connected
      </Box>
    </Box>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Box sx={CARD_SX}>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 1, textAlign: 'center' }}>{text}</Box>
    </Box>
  );
}

const Column = ({ children }: { children: ReactNode }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{children}</Box>
);

// ── Temps ────────────────────────────────────────────────────────────────────

export function TempsView() {
  const { latest } = useLhmSensors();
  if (!latest) return <Box sx={CARD_SX}><GatheringPlaceholder /></Box>;
  if (!latest.available || !latest.groups) return <NotConnected />;
  const groups = groupByHardware(latest.groups.temperatures);
  if (groups.size === 0) return <EmptyCard text="No temperature sensors" />;
  return (
    <Column>
      {[...groups].map(([hw, rows]) => (
        <GroupCard key={hw} title={hw} cardId={sensorGroupPinId('temp', rows[0].hardwareId)}>
          {rows.map((r, i) => (
            <Row key={r.name + i} label={r.name} value={r.value.toFixed(1)} unit="°C" color={tempColor(r.value)} />
          ))}
        </GroupCard>
      ))}
    </Column>
  );
}

// ── Fans ─────────────────────────────────────────────────────────────────────

export function FansView() {
  const { latest } = useLhmSensors();
  if (!latest) return <Box sx={CARD_SX}><GatheringPlaceholder /></Box>;
  if (!latest.available || !latest.groups) return <NotConnected />;
  const { fans, controls } = latest.groups;
  if (fans.length === 0) return <EmptyCard text="No fan sensors" />;

  const controlFor = (f: LhmReading) =>
    controls.find(c => c.hardwareId === f.hardwareId && c.name === f.name)?.value ?? null;

  const groups = groupByHardware(fans);
  return (
    <Column>
      {[...groups].map(([hw, rows]) => (
        <GroupCard key={hw} title={hw} cardId={sensorGroupPinId('fan', rows[0].hardwareId)}>
          {rows.map((f, i) => {
            const pct = controlFor(f);
            const stopped = f.value <= 0;
            return (
              <Row
                key={f.name + i}
                label={f.name}
                value={stopped ? 'stopped' : f.value.toLocaleString()}
                unit={stopped ? '' : `RPM${pct !== null ? `  ·  ${Math.round(pct)}%` : ''}`}
                color={stopped ? 'var(--text-dim)' : '#06b6d4'}
                dim={stopped}
              />
            );
          })}
        </GroupCard>
      ))}
    </Column>
  );
}

// ── Power ────────────────────────────────────────────────────────────────────

const POWER_COLOR = '#a855f7';

export function PowerView() {
  const { latest, powerHistory } = useLhmSensors();
  if (!latest) return <Box sx={CARD_SX}><GatheringPlaceholder /></Box>;
  if (!latest.available || !latest.groups) return <NotConnected />;
  const { powers } = latest.groups;
  if (powers.length === 0) return <EmptyCard text="No power sensors" />;

  const cpuPkg = powers.find(p => p.hardwareId.includes('cpu') && p.name === 'Package')?.value ?? null;
  const gpuPkg = powers.find(p => /^GPU (Package|Power)$/.test(p.name))?.value ?? null;
  const combined = combinedPowerW(latest.groups);

  // Detailed list, minus the noisy per-core SMU entries.
  const detail = powers.filter(p => !/^Core #\d+/.test(p.name));
  const groups = groupByHardware(detail);

  const Big = ({ label, value, color }: { label: string; value: number | null; color: string }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', px: 2, py: 1, flex: 1 }}>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1.1 }}>
        {value !== null ? Math.round(value) : '—'}<Box component="span" sx={{ fontSize: '0.7rem', ml: 0.3, color: 'var(--text-dim)' }}>W</Box>
      </Box>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', mt: 0.4 }}>{label}</Box>
    </Box>
  );

  return (
    <Column>
      <Box sx={CARD_SX}>
        <Box sx={{ ...TITLE_SX, mb: 1 }}>POWER DRAW</Box>
        <Box sx={{ display: 'flex', gap: 1.5, mb: powerHistory.length > 1 ? 1.5 : 0 }}>
          <Big label="CPU" value={cpuPkg} color="#f59e0b" />
          <Big label="GPU" value={gpuPkg} color="#10b981" />
          <Big label="COMBINED" value={combined} color={POWER_COLOR} />
        </Box>
        {powerHistory.length > 1 && (
          <Box sx={chartFillSx(100)}>
            <LineChart
              skipAnimation
              xAxis={[{ data: powerHistory.map((_, i) => i), scaleType: 'linear', tickNumber: 4, height: 18, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
              yAxis={[{ min: 0, max: Math.max(50, ...powerHistory) * 1.2, width: 30, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: (v: number) => `${v}W` }]}
              series={[{ data: powerHistory, color: POWER_COLOR, area: true, showMark: false, label: 'W' }]}
              margin={{ top: 10, bottom: 6, left: 4, right: 8 }}
              sx={chartSx}
            />
          </Box>
        )}
        <Box sx={{ fontSize: '0.6rem', color: 'var(--text-dim)', mt: 1, fontFamily: 'var(--font-mono)' }}>
          Component power (CPU + GPU) — not whole-system / wall power.
        </Box>
      </Box>
      {[...groups].map(([hw, rows]) => (
        <GroupCard key={hw} title={hw} cardId={sensorGroupPinId('power', rows[0].hardwareId)}>
          {rows.map((p, i) => (
            <Row key={p.name + i} label={p.name} value={p.value.toFixed(1)} unit="W" color="#c084fc" />
          ))}
        </GroupCard>
      ))}
    </Column>
  );
}
