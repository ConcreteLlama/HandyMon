import { z } from 'zod';
import ini from 'ini';
import { formatCoreRanges } from './process-rule-presets';

export const CpuLimitRuleSchema = z.object({
  exe: z.string(),
  cores: z.number().array(),
})

export type CpuLimitRule = z.infer<typeof CpuLimitRuleSchema>;
export const parseCpuLimitRules = (raw: string): CpuLimitRule[] => {
  if (!raw) return [];

  const parts = raw.split(',').map(p => p.trim());
  const rules: CpuLimitRule[] = [];

  for (let i = 0; i < parts.length - 1; i += 2) {
    const exe = parts[i];
    const rawSpec = parts[i + 1];

    const coreSpec = rawSpec.startsWith('(') && rawSpec.endsWith(')')
      ? rawSpec.slice(1, -1)
      : rawSpec;

    const cores: number[] = [];

    coreSpec.split(';').forEach(segment => {
      const [startStr, endStr] = segment.split('-');
      const start = Number(startStr);
      const end = endStr !== undefined ? Number(endStr) : undefined;

      if (!isNaN(start)) {
        if (end !== undefined && !isNaN(end)) {
          for (let n = start; n <= end; n++) cores.push(n);
        } else {
          cores.push(start);
        }
      }
    });

    if (exe && cores.length > 0) {
      rules.push({ exe, cores });
    }
  }

  return rules;
};

export const stringifyCpuLimitRules = (rules: CpuLimitRule[]): string => {
  return rules.map(({ exe, cores }) => `${exe},(${formatCoreRanges(cores, ';')})`).join(',');
};

// Windows IO_PRIORITY_HINT values, matched to what Process Lasso itself
// writes to DefaultIOPriorities (confirmed against a live prolasso.ini —
// same flat "exe,value[,exe,value...]" shape as CPUSets, just a single
// number instead of a core-range spec).
export const IO_PRIORITY_LEVELS = [0, 1, 2, 3] as const;
export type IoPriorityLevel = typeof IO_PRIORITY_LEVELS[number];
export const IO_PRIORITY_LABELS: Record<IoPriorityLevel, string> = {
  0: 'Very Low',
  1: 'Low',
  2: 'Normal',
  3: 'High',
};

export const IoPriorityRuleSchema = z.object({
  exe: z.string(),
  priority: z.union(IO_PRIORITY_LEVELS.map(n => z.literal(n)) as [z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]),
});
export type IoPriorityRule = z.infer<typeof IoPriorityRuleSchema>;

export const parseIoPriorityRules = (raw: string): IoPriorityRule[] => {
  if (!raw) return [];
  const parts = raw.split(',').map(p => p.trim());
  const rules: IoPriorityRule[] = [];
  for (let i = 0; i < parts.length - 1; i += 2) {
    const exe = parts[i];
    const priority = Number(parts[i + 1]);
    if (exe && IO_PRIORITY_LEVELS.includes(priority as IoPriorityLevel)) {
      rules.push({ exe, priority: priority as IoPriorityLevel });
    }
  }
  return rules;
};

export const stringifyIoPriorityRules = (rules: IoPriorityRule[]): string => {
  return rules.map(({ exe, priority }) => `${exe},${priority}`).join(',');
};

// Windows priority classes, matched to what Process Lasso itself writes to
// DefaultPriorities — confirmed live against a real prolasso.ini for
// "above normal" (set via the app's own "CPU Priority" UI); the other five
// are inferred by symmetry (lowercase, space-separated, matching Process
// Lasso's own displayed labels) but not independently confirmed the same way.
export const CPU_PRIORITY_LEVELS = ['idle', 'below normal', 'normal', 'above normal', 'high', 'realtime'] as const;
export type CpuPriorityLevel = typeof CPU_PRIORITY_LEVELS[number];
export const CPU_PRIORITY_LABELS: Record<CpuPriorityLevel, string> = {
  idle: 'Idle',
  'below normal': 'Below Normal',
  normal: 'Normal',
  'above normal': 'Above Normal',
  high: 'High',
  realtime: 'Realtime',
};

export const CpuPriorityRuleSchema = z.object({
  exe: z.string(),
  priority: z.enum(CPU_PRIORITY_LEVELS),
});
export type CpuPriorityRule = z.infer<typeof CpuPriorityRuleSchema>;

export const parseCpuPriorityRules = (raw: string): CpuPriorityRule[] => {
  if (!raw) return [];
  const parts = raw.split(',').map(p => p.trim());
  const rules: CpuPriorityRule[] = [];
  for (let i = 0; i < parts.length - 1; i += 2) {
    const exe = parts[i];
    const priority = parts[i + 1].toLowerCase();
    if (exe && (CPU_PRIORITY_LEVELS as readonly string[]).includes(priority)) {
      rules.push({ exe, priority: priority as CpuPriorityLevel });
    }
  }
  return rules;
};

export const stringifyCpuPriorityRules = (rules: CpuPriorityRule[]): string => {
  return rules.map(({ exe, priority }) => `${exe},${priority}`).join(',');
};

// The "Induce Performance Mode" per-process checkbox — confirmed live via a
// before/after diff of prolasso.ini — populates GamingMode's
// AutomaticGamingModeProcessPaths with a plain comma-separated exe list (no
// values, just membership: launching one of these exes engages Gaming Mode).
export const parsePerformanceModeExes = (raw: string): string[] => {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
};

export const stringifyPerformanceModeExes = (exes: string[]): string => exes.join(',');

const ProcessLassoCPUSetsRuntime = z.union([CpuLimitRuleSchema.array(), z.string()]).transform((value) => typeof value === 'string' ? parseCpuLimitRules(value) : value);
const ProcessLassoCPUSetsOutput  = CpuLimitRuleSchema.array().transform(stringifyCpuLimitRules)

const ProcessLassoIoPrioritiesRuntime = z.union([IoPriorityRuleSchema.array(), z.string()]).transform((value) => typeof value === 'string' ? parseIoPriorityRules(value) : value);
const ProcessLassoIoPrioritiesOutput  = IoPriorityRuleSchema.array().transform(stringifyIoPriorityRules)

const ProcessLassoCpuPrioritiesRuntime = z.union([CpuPriorityRuleSchema.array(), z.string()]).transform((value) => typeof value === 'string' ? parseCpuPriorityRules(value) : value);
const ProcessLassoCpuPrioritiesOutput  = CpuPriorityRuleSchema.array().transform(stringifyCpuPriorityRules)

const ProcessLassoPerformanceModeExesRuntime = z.union([z.string().array(), z.string()]).transform((value) => typeof value === 'string' ? parsePerformanceModeExes(value) : value);
const ProcessLassoPerformanceModeExesOutput  = z.string().array().transform(stringifyPerformanceModeExes)

export const ProcessLassoProcessDefaultsRuntime = z.object({
  CPUSets: ProcessLassoCPUSetsRuntime,
  DefaultIOPriorities: ProcessLassoIoPrioritiesRuntime,
  DefaultPriorities: ProcessLassoCpuPrioritiesRuntime,
}).passthrough().optional();

export const ProcessLassoProcessDefaultsOutput = z.object({
  CPUSets: ProcessLassoCPUSetsOutput,
  DefaultIOPriorities: ProcessLassoIoPrioritiesOutput,
  DefaultPriorities: ProcessLassoCpuPrioritiesOutput,
}).passthrough().optional();

export const ProcessLassoGamingModeRuntime = z.object({
  AutomaticGamingModeProcessPaths: ProcessLassoPerformanceModeExesRuntime,
}).passthrough().optional();

export const ProcessLassoGamingModeOutput = z.object({
  AutomaticGamingModeProcessPaths: ProcessLassoPerformanceModeExesOutput,
}).passthrough().optional();

export const ProcessLassoRuntimeConfigSchema = z.object({
  ProcessDefaults: ProcessLassoProcessDefaultsRuntime,
  GamingMode: ProcessLassoGamingModeRuntime,
}).passthrough();

export const ProcessLassoOutputConfigSchema = ProcessLassoRuntimeConfigSchema.extend({
    ProcessDefaults: ProcessLassoProcessDefaultsOutput,
    GamingMode: ProcessLassoGamingModeOutput,
});

export type ProcessLassoRuntimeConfig = z.infer<typeof ProcessLassoRuntimeConfigSchema>;
export type ProcessLassoOutputConfig = z.infer<typeof ProcessLassoOutputConfigSchema>;

export const processLassoConfigFromString = (configString: string) => {
  const fileContents = configString.replace(/^\uFEFF/, '');
  const iniParsed = ini.parse(fileContents);
  return ProcessLassoRuntimeConfigSchema.parse(iniParsed);
}

export const processLassoConfigToString = (config: ProcessLassoRuntimeConfig) => {
  const transformed = ProcessLassoOutputConfigSchema.parse(config);
  const iniValue = ini.encode(transformed);
  return iniValue;
}

