'use client';

import { useLhmSensors } from '@/hooks/perf/useLhmSensors';
import { GatheringPlaceholder, GroupCard, Row, tempColor } from './shared';
import type { LhmReading } from '@/types/perf';

// Pins a whole hardware group (e.g. "GIGABYTE X870 AORUS ELITE" temps, or
// "AMD RYZEN 9 9950X3D" power rails) rather than an individual sensor — the
// pin system's registry (registry.tsx's CARD_MAP) is a fixed, hand-picked
// list, which doesn't fit hardware discovered live from LHM. Encoding
// kind+hardwareId straight into the pin id string (instead of extending the
// registry itself) means Overview's rendering can dispatch purely by parsing
// the id, no separate lookup table needed for these.
export type SensorGroupKind = 'temp' | 'fan' | 'power';

export function sensorGroupPinId(kind: SensorGroupKind, hardwareId: string): string {
  return `${kind}:${hardwareId}`;
}

// Every static registry id (registry.tsx) is a bare word with no colon, so a
// colon is an unambiguous signal this is a dynamic sensor-group id instead.
export function parseSensorGroupPinId(id: string): { kind: SensorGroupKind; hardwareId: string } | null {
  const i = id.indexOf(':');
  if (i === -1) return null;
  const kind = id.slice(0, i);
  if (kind !== 'temp' && kind !== 'fan' && kind !== 'power') return null;
  return { kind, hardwareId: id.slice(i + 1) };
}

export function SensorGroupCard({ cardId, kind, hardwareId }: { cardId: string; kind: SensorGroupKind; hardwareId: string }) {
  const { latest } = useLhmSensors();

  if (!latest) return <GroupCard title="Sensor group" cardId={cardId}><GatheringPlaceholder /></GroupCard>;
  if (!latest.available || !latest.groups) {
    return <GroupCard title="Sensor group" cardId={cardId}><Row label="LibreHardwareMonitor not connected" value="" unit="" dim /></GroupCard>;
  }

  const source = kind === 'temp' ? latest.groups.temperatures : kind === 'fan' ? latest.groups.fans : latest.groups.powers;
  // Same noisy-entry exclusion PowerView applies before grouping — a pin
  // made from what PowerView showed should keep matching it.
  const filtered = kind === 'power' ? source.filter(p => !/^Core #\d+/.test(p.name)) : source;
  const rows = filtered.filter(r => r.hardwareId === hardwareId);

  // Hardware can vanish between reads (unplugged, renamed, different PC) —
  // still show the card (with its pin button, so it's easy to unpin) rather
  // than silently disappearing with no explanation.
  if (rows.length === 0) {
    return <GroupCard title="Sensor group" cardId={cardId}><Row label="Not found — may have been unplugged or renamed" value="" unit="" dim /></GroupCard>;
  }

  const title = rows[0].hardware;
  const controlFor = (f: LhmReading) =>
    kind === 'fan' ? (latest.groups!.controls.find(c => c.hardwareId === f.hardwareId && c.name === f.name)?.value ?? null) : null;

  return (
    <GroupCard title={title} cardId={cardId}>
      {rows.map((r, i) => {
        if (kind === 'temp') {
          return <Row key={r.name + i} label={r.name} value={r.value.toFixed(1)} unit="°C" color={tempColor(r.value)} />;
        }
        if (kind === 'fan') {
          const pct = controlFor(r);
          const stopped = r.value <= 0;
          return (
            <Row
              key={r.name + i}
              label={r.name}
              value={stopped ? 'stopped' : r.value.toLocaleString()}
              unit={stopped ? '' : `RPM${pct !== null ? `  ·  ${Math.round(pct)}%` : ''}`}
              color={stopped ? 'var(--text-dim)' : '#06b6d4'}
              dim={stopped}
            />
          );
        }
        return <Row key={r.name + i} label={r.name} value={r.value.toFixed(1)} unit="W" color="#c084fc" />;
      })}
    </GroupCard>
  );
}
