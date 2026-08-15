'use client';

import type { ComponentType } from 'react';
import { CpuStatCard, GpuStatCard, MemStatCard, VramStatCard } from './CompactStatCards';
import { CpuUsageCard } from './CpuUsageCard';
import { CpuCoresCard } from './CpuCoresCard';
import { CpuTempCard } from './CpuTempCard';
import { CpuPowerCard } from './CpuPowerCard';
import { CpuClocksCard } from './CpuClocksCard';
import { GpuUsageCard } from './GpuUsageCard';
import { GpuVramCard } from './GpuVramCard';
import { GpuTempCard } from './GpuTempCard';
import { GpuPowerCard } from './GpuPowerCard';
import { GpuClocksCard } from './GpuClocksCard';
import { MemUsageCard } from './MemUsageCard';
import { PagefileCard } from './PagefileCard';
import { DiskIoCard } from './DiskIoCard';
import { NetworkCard } from './NetworkCard';
import { ProcessTableCard } from './ProcessTableCard';
import { FpsStatsCard } from './FpsStatsCard';
import { FpsChartCard } from './FpsChartCard';
import { FrametimeCard } from './FrametimeCard';
import { parseSensorGroupPinId } from './SensorGroupCard';

export interface CardDef {
  id: string;
  label: string;
  component: ComponentType;
}

export interface CardGroup {
  label: string;
  cards: CardDef[];
}

export const CARD_GROUPS: CardGroup[] = [
  {
    label: 'ESSENTIALS',
    cards: [
      { id: 'cpu-stat',  label: 'CPU Summary',    component: CpuStatCard  },
      { id: 'gpu-stat',  label: 'GPU Summary',    component: GpuStatCard  },
      { id: 'mem-stat',  label: 'Memory Summary', component: MemStatCard  },
      { id: 'vram-stat', label: 'VRAM Summary',   component: VramStatCard },
    ],
  },
  {
    label: 'CPU',
    cards: [
      { id: 'cpu-usage',  label: 'CPU Usage',  component: CpuUsageCard  },
      { id: 'cpu-cores',  label: 'CPU Cores',  component: CpuCoresCard  },
      { id: 'cpu-temp',   label: 'CPU Temp',   component: CpuTempCard   },
      { id: 'cpu-power',  label: 'CPU Power',  component: CpuPowerCard  },
      { id: 'cpu-clocks', label: 'CPU Clocks', component: CpuClocksCard },
    ],
  },
  {
    label: 'GPU',
    cards: [
      { id: 'gpu-usage',   label: 'GPU Usage',   component: GpuUsageCard   },
      { id: 'gpu-vram',    label: 'GPU VRAM',    component: GpuVramCard    },
      { id: 'gpu-temp',    label: 'GPU Temp',    component: GpuTempCard    },
      { id: 'gpu-power',   label: 'GPU Power',   component: GpuPowerCard   },
      { id: 'gpu-clocks',  label: 'GPU Clocks',  component: GpuClocksCard  },
    ],
  },
  {
    label: 'MEMORY',
    cards: [
      { id: 'mem-usage', label: 'Memory Usage', component: MemUsageCard },
      { id: 'pagefile',  label: 'Page File',    component: PagefileCard },
    ],
  },
  {
    label: 'FPS',
    cards: [
      { id: 'fps-stats',  label: 'Frame Stats',    component: FpsStatsCard  },
      { id: 'fps-chart',  label: 'Framerate Chart', component: FpsChartCard  },
      { id: 'frametime',  label: 'Frametime Chart', component: FrametimeCard },
    ],
  },
  {
    label: 'SYSTEM',
    cards: [
      { id: 'disk-io',   label: 'Disk I/O',   component: DiskIoCard      },
      { id: 'network',   label: 'Network',    component: NetworkCard     },
      { id: 'processes', label: 'Processes',  component: ProcessTableCard },
    ],
  },
];

export const CARD_REGISTRY: CardDef[] = CARD_GROUPS.flatMap(g => g.cards);
export const CARD_MAP = new Map(CARD_REGISTRY.map(c => [c.id, c]));

// Card ids that belong to the FPS group — used to decide whether the
// PresentMon CAPTURE/HISTORY/CONFIG/RESET toolbar should show on OVERVIEW
// (only meaningful there if a card it applies to is actually pinned).
export const FPS_CARD_IDS = new Set(CARD_GROUPS.find(g => g.label === 'FPS')!.cards.map(c => c.id));

const STORAGE_KEY = 'perf-pinned-cards';

export function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // A dynamic sensor-group id (see SensorGroupCard.tsx) isn't in CARD_MAP
    // — it's parameterized (kind+hardwareId) rather than a fixed component,
    // since it comes from whatever hardware LHM actually discovers, not a
    // hand-picked registry. parseSensorGroupPinId just checks the id is
    // well-formed (a colon-prefixed kind), no live-data lookup needed here.
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && (CARD_MAP.has(id) || parseSensorGroupPinId(id) !== null)) : [];
  } catch {
    return [];
  }
}

export function savePinned(ids: string[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
}
