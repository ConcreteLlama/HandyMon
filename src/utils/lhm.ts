import { z } from 'zod';
import { getAppConfig } from '@/utils/app-config';
import type { LhmReading, LhmSensorGroups } from '@/types/perf';

// ── LibreHardwareMonitor web-server sensor source (/data.json, port configurable) ──
// LHM serves a nested tree: root → computer → hardware → category → sensor.
// Values are unit-suffixed strings ("55.8 °C", "42.9 W", "4069.0 MHz", "16303.0 MB").
// We navigate by HardwareId (stable) + sensor Type/Text rather than display names.
// Requires PawnIO installed for CPU (SMU) + motherboard (Super-I/O) reads — see
// docs/windows-dependencies.md. Port is set in settings (default 8085).

const LHM_TIMEOUT_MS = 800;

function lhmUrl(port: number): string {
  return `http://localhost:${port}/data.json`;
}

// Recursive node schema. Kept lenient — different node levels carry different keys.
export interface LhmNode {
  id: number;
  Text: string;
  Value?: string;
  SensorId?: string;
  Type?: string;
  HardwareId?: string;
  Children: LhmNode[];
}

const LhmNodeSchema: z.ZodType<LhmNode> = z.lazy(() =>
  z.object({
    id: z.number(),
    Text: z.string(),
    Value: z.string().optional(),
    SensorId: z.string().optional(),
    Type: z.string().optional(),
    HardwareId: z.string().optional(),
    Children: z.array(LhmNodeSchema),
  }),
);

export interface LhmSensorStats {
  cpu: {
    overall: number | null;
    cores: number[];
    packageTempC: number | null;
    packagePowerW: number | null;
    // "Effective" clock (LHM's own term) — real current frequency accounting
    // for time spent in low-power states, not the near-static boost target
    // ("Cores (Average)" stays pinned close to max almost always and isn't
    // informative moment-to-moment). avgClockMhz reads LHM's own "Cores
    // (Average Effective)" aggregate directly; maxClockMhz is the highest
    // single core's effective clock right now (which core boosts highest),
    // computed from the individual "Core #N (Effective)" sensors since LHM
    // doesn't expose a pre-aggregated max.
    avgClockMhz: number | null;
    maxClockMhz: number | null;
  };
  gpu: {
    utilization: number | null;
    dedicatedVramMb: number | null;
    totalVramMb: number | null;
    tempC: number | null;
    powerW: number | null;
    coreClockMhz: number | null;
    memClockMhz: number | null;
  };
}

// Strip the unit suffix and parse the leading number. "-" / empty → null.
function parseNum(v?: string): number | null {
  if (!v) return null;
  const m = v.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return isFinite(n) ? n : null;
}

// The top-level hardware nodes are the children of the single computer node.
function hardwareNodes(root: LhmNode): LhmNode[] {
  return root.Children?.[0]?.Children ?? [];
}

function findHardware(root: LhmNode, pred: (hardwareId: string) => boolean): LhmNode | null {
  return hardwareNodes(root).find(h => (h.HardwareId ? pred(h.HardwareId) : false)) ?? null;
}

// Depth-first search under a hardware node for a sensor matching Type (or any
// type when null) and Text. Returns the parsed numeric value.
function findSensor(node: LhmNode, type: string | null, text: string | RegExp): number | null {
  const stack: LhmNode[] = [...(node.Children ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    const typeOk = type === null || n.Type === type;
    const textOk = typeof text === 'string' ? n.Text === text : text.test(n.Text);
    if (typeOk && textOk) return parseNum(n.Value);
    if (n.Children?.length) stack.push(...n.Children);
  }
  return null;
}

function cpuCores(cpu: LhmNode): number[] {
  const found: { i: number; v: number }[] = [];
  const stack: LhmNode[] = [...(cpu.Children ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.Type === 'Load') {
      const m = n.Text.match(/^CPU Core #(\d+)$/);
      const v = parseNum(n.Value);
      if (m && v !== null) found.push({ i: parseInt(m[1], 10), v });
    }
    if (n.Children?.length) stack.push(...n.Children);
  }
  return found.sort((a, b) => a.i - b.i).map(c => Math.round(c.v * 10) / 10);
}

// Per-core effective (real, not boost-target) clocks — "Core #N (Effective)"
// sensors, Type "Clock". Used to derive the highest-boosting core right now;
// the average comes straight from LHM's own "Cores (Average Effective)"
// aggregate instead of being recomputed from this array.
function cpuCoreEffectiveClocks(cpu: LhmNode): number[] {
  const found: number[] = [];
  const stack: LhmNode[] = [...(cpu.Children ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.Type === 'Clock' && /^Core #\d+ \(Effective\)$/.test(n.Text)) {
      const v = parseNum(n.Value);
      if (v !== null) found.push(v);
    }
    if (n.Children?.length) stack.push(...n.Children);
  }
  return found;
}

const round  = (v: number | null) => (v !== null ? Math.round(v) : null);
const round1 = (v: number | null) => (v !== null ? Math.round(v * 10) / 10 : null);

function mapLhm(root: LhmNode): LhmSensorStats | null {
  const cpu = findHardware(root, id => id.startsWith('/amdcpu') || id.startsWith('/intelcpu'));
  // Prefer a discrete NVIDIA GPU over an integrated AMD/Intel one.
  const gpu =
    findHardware(root, id => id.startsWith('/gpu-nvidia')) ??
    findHardware(root, id => id.startsWith('/gpu-amd') || id.startsWith('/gpu-ati') || id.startsWith('/gpu-intel'));

  if (!cpu && !gpu) return null;

  const cpuEffectiveClocks = cpu ? cpuCoreEffectiveClocks(cpu) : [];

  return {
    cpu: {
      overall:       round1(cpu ? findSensor(cpu, 'Load', 'CPU Total') : null),
      cores:         cpu ? cpuCores(cpu) : [],
      // "Core (Tctl/Tdie)" (AMD, Amd17Cpu.cs) vs "CPU Package" (Intel,
      // IntelCpu.cs) — confirmed against LHM's own source, not guessed.
      // AMD's sensor for this was package-temp-only on Intel too, but exact-
      // string matching against just the AMD name meant Intel CPUs always
      // read null here despite LHM reporting the value fine (confirmed live:
      // the Temps page — no name filtering there — showed it correctly).
      packageTempC:  round(cpu ? findSensor(cpu, 'Temperature', /^(Core \(Tctl\/Tdie\)|CPU Package)$/) : null),
      // Same AMD/Intel split: "Package" (AMD) vs "CPU Package" (Intel).
      packagePowerW: round(cpu ? findSensor(cpu, 'Power', /^(Package|CPU Package)$/) : null),
      avgClockMhz:   round(cpu ? findSensor(cpu, 'Clock', 'Cores (Average Effective)') : null),
      maxClockMhz:   cpuEffectiveClocks.length ? round(Math.max(...cpuEffectiveClocks)) : null,
    },
    gpu: {
      utilization:     round(gpu ? findSensor(gpu, 'Load', 'GPU Core') : null),
      dedicatedVramMb: round(gpu ? findSensor(gpu, null, 'GPU Memory Used') : null),
      totalVramMb:     round(gpu ? findSensor(gpu, null, 'GPU Memory Total') : null),
      tempC:           round(gpu ? findSensor(gpu, 'Temperature', 'GPU Core') : null),
      powerW:          round(gpu ? findSensor(gpu, 'Power', /^GPU (Package|Power)$/) : null),
      coreClockMhz:    round(gpu ? findSensor(gpu, 'Clock', 'GPU Core') : null),
      memClockMhz:     round(gpu ? findSensor(gpu, 'Clock', 'GPU Memory') : null),
    },
  };
}

export async function fetchLhmStats(): Promise<LhmSensorStats | null> {
  try {
    const res = await fetch(lhmUrl(getAppConfig().lhmPort), { signal: AbortSignal.timeout(LHM_TIMEOUT_MS) });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = LhmNodeSchema.safeParse(json);
    if (!parsed.success) return null;
    return mapLhm(parsed.data);
  } catch {
    return null;
  }
}

export async function checkLhmAvailable(): Promise<{ available: boolean; source: 'lhm' | null }> {
  const stats = await fetchLhmStats();
  const ok = stats !== null && stats.cpu.overall !== null;
  return ok ? { available: true, source: 'lhm' } : { available: false, source: null };
}

// ── Generic sensor lists (Temps / Fans / Power tabs) ─────────────────────────
// Collect every sensor of a given Type across all hardware, in tree order.

// Threshold/limit temperature nodes we don't want listed as live temps.
const TEMP_NOISE = /limit|warning|critical|threshold|resolution/i;

function collectByType(hw: LhmNode, type: string, out: LhmReading[]) {
  const hardware = hw.Text;
  const hardwareId = hw.HardwareId ?? '';
  const walk = (node: LhmNode) => {
    for (const c of node.Children ?? []) {
      if (c.Type === type) {
        const v = parseNum(c.Value);
        if (v !== null) out.push({ hardware, hardwareId, name: c.Text, value: v });
      }
      walk(c);
    }
  };
  walk(hw);
}

export function extractSensorGroups(root: LhmNode): LhmSensorGroups {
  const temperatures: LhmReading[] = [];
  const powers: LhmReading[] = [];
  const fans: LhmReading[] = [];
  const controls: LhmReading[] = [];
  for (const hw of hardwareNodes(root)) {
    collectByType(hw, 'Temperature', temperatures);
    collectByType(hw, 'Power', powers);
    collectByType(hw, 'Fan', fans);
    collectByType(hw, 'Control', controls);
  }
  return { temperatures: temperatures.filter(r => !TEMP_NOISE.test(r.name)), powers, fans, controls };
}

export async function fetchLhmSensorGroups(): Promise<LhmSensorGroups | null> {
  try {
    const res = await fetch(lhmUrl(getAppConfig().lhmPort), { signal: AbortSignal.timeout(LHM_TIMEOUT_MS) });
    if (!res.ok) return null;
    const parsed = LhmNodeSchema.safeParse(await res.json());
    if (!parsed.success) return null;
    return extractSensorGroups(parsed.data);
  } catch {
    return null;
  }
}

// Server-side connectivity probe for a given port — powers the settings "test"
// button (the browser, which may be a remote device, can't reach the LHM port
// itself). Returns a short human-readable detail on success.
export async function probeLhm(port: number): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(lhmUrl(port), { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const parsed = LhmNodeSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, detail: 'unexpected response — is this the LHM web server?' };
    const root = parsed.data;
    const computer = root.Children?.[0]?.Text ?? 'unknown';
    const devices = hardwareNodes(root).length;
    const cpuTemp = mapLhm(root)?.cpu.packageTempC;
    const temp = cpuTemp != null ? ` · CPU ${cpuTemp}°C` : '';
    return { ok: true, detail: `${computer} · ${devices} devices${temp}` };
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'TimeoutError';
    return { ok: false, detail: timeout ? 'no response (timeout)' : 'not reachable' };
  }
}
