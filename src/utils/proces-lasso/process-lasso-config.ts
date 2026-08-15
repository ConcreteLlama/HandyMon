import { CONFIG } from "@/config";
import { CpuLimitRule, CpuPriorityLevel, CpuPriorityRule, IoPriorityLevel, IoPriorityRule, processLassoConfigFromString, processLassoConfigToString, ProcessLassoRuntimeConfig, ProcessLassoRuntimeConfigSchema } from "@/utils/proces-lasso/process-lasso";
import fs from 'fs';
import { decode, encode } from 'iconv-lite';
import _ from "lodash";
import path from "path";

// Every writer below re-establishes this same fallback shape when
// ProcessDefaults is absent (e.g. a fresh Process Lasso install) — kept as
// one constant so the three list fields stay in sync as more get added.
const EMPTY_PROCESS_DEFAULTS = { CPUSets: [], DefaultIOPriorities: [], DefaultPriorities: [] };

const PROCESS_LASSO_CONFIG_FILE = path.join(CONFIG.processLasso.configPath, 'config', 'prolasso.ini');

export const getProcessLassoConfig = async (): Promise<ProcessLassoRuntimeConfig> => {
  const fileBuffer = fs.readFileSync(PROCESS_LASSO_CONFIG_FILE);
  const fileContents = decode(fileBuffer, 'utf-16'); // BOM-aware decoding
  const parsed = processLassoConfigFromString(fileContents);
  return parsed;
};

export const setProcessLassoConfig = async(config: ProcessLassoRuntimeConfig) => {
  const stringValue = processLassoConfigToString(config);
  const encoded = encode(stringValue, 'utf-16'); // automatically includes BOM
  fs.writeFileSync(PROCESS_LASSO_CONFIG_FILE, encoded);
  return {
    config,
    stringValue,
  };
};

export const setCpuSet = async(cpuSetName: string, cores: number[]) => {
    const currentConfig = await getProcessLassoConfig();
    currentConfig.ProcessDefaults = currentConfig.ProcessDefaults || EMPTY_PROCESS_DEFAULTS;
    const currentValueIdx = currentConfig.ProcessDefaults.CPUSets.findIndex((val) => val.exe === cpuSetName);
    const newValue: CpuLimitRule = {
      exe: cpuSetName,
      cores,
    };
    if (currentValueIdx !== -1) {
      currentConfig.ProcessDefaults.CPUSets[currentValueIdx] = newValue;
    } else {
      currentConfig.ProcessDefaults.CPUSets = [newValue, ...currentConfig.ProcessDefaults.CPUSets];
    }
    return await setProcessLassoConfig(currentConfig);
}

export const removeCpuSet = async(cpuSetName: string) => {
    const currentValue = await getProcessLassoConfig();
    currentValue.ProcessDefaults = currentValue.ProcessDefaults || EMPTY_PROCESS_DEFAULTS;
    const cpuSetsValue = currentValue.ProcessDefaults?.CPUSets || [];
    currentValue.ProcessDefaults.CPUSets = cpuSetsValue.filter((value) => value.exe !== cpuSetName);
    return await setProcessLassoConfig(currentValue);
}

// `order` is the full list of exe names in the desired order (as returned by getProcessLassoConfig).
export const reorderCpuSets = async(order: string[]) => {
    const currentConfig = await getProcessLassoConfig();
    const cpuSets = currentConfig.ProcessDefaults?.CPUSets || [];
    const byExe = new Map(cpuSets.map((rule) => [rule.exe, rule] as const));
    const reordered = order.map((exe) => byExe.get(exe)).filter((rule): rule is CpuLimitRule => !!rule);
    const missing = cpuSets.filter((rule) => !order.includes(rule.exe));
    currentConfig.ProcessDefaults = currentConfig.ProcessDefaults || EMPTY_PROCESS_DEFAULTS;
    currentConfig.ProcessDefaults.CPUSets = [...reordered, ...missing];
    return await setProcessLassoConfig(currentConfig);
}

export const setIoPriority = async(exe: string, priority: IoPriorityLevel) => {
    const currentConfig = await getProcessLassoConfig();
    currentConfig.ProcessDefaults = currentConfig.ProcessDefaults || EMPTY_PROCESS_DEFAULTS;
    const ioPriorities = currentConfig.ProcessDefaults.DefaultIOPriorities || [];
    const currentValueIdx = ioPriorities.findIndex((val) => val.exe === exe);
    const newValue: IoPriorityRule = { exe, priority };
    if (currentValueIdx !== -1) {
      ioPriorities[currentValueIdx] = newValue;
    } else {
      ioPriorities.unshift(newValue);
    }
    currentConfig.ProcessDefaults.DefaultIOPriorities = ioPriorities;
    return await setProcessLassoConfig(currentConfig);
}

export const removeIoPriority = async(exe: string) => {
    const currentConfig = await getProcessLassoConfig();
    currentConfig.ProcessDefaults = currentConfig.ProcessDefaults || EMPTY_PROCESS_DEFAULTS;
    const ioPriorities = currentConfig.ProcessDefaults.DefaultIOPriorities || [];
    currentConfig.ProcessDefaults.DefaultIOPriorities = ioPriorities.filter((value) => value.exe !== exe);
    return await setProcessLassoConfig(currentConfig);
}

// `order` is the full list of exe names in the desired order — entries with
// no IO priority set are silently skipped, same as reorderCpuSets.
export const reorderIoPriorities = async(order: string[]) => {
    const currentConfig = await getProcessLassoConfig();
    const ioPriorities = currentConfig.ProcessDefaults?.DefaultIOPriorities || [];
    const byExe = new Map(ioPriorities.map((rule) => [rule.exe, rule] as const));
    const reordered = order.map((exe) => byExe.get(exe)).filter((rule): rule is IoPriorityRule => !!rule);
    const missing = ioPriorities.filter((rule) => !order.includes(rule.exe));
    currentConfig.ProcessDefaults = currentConfig.ProcessDefaults || EMPTY_PROCESS_DEFAULTS;
    currentConfig.ProcessDefaults.DefaultIOPriorities = [...reordered, ...missing];
    return await setProcessLassoConfig(currentConfig);
}

export const setCpuPriority = async(exe: string, priority: CpuPriorityLevel) => {
    const currentConfig = await getProcessLassoConfig();
    currentConfig.ProcessDefaults = currentConfig.ProcessDefaults || EMPTY_PROCESS_DEFAULTS;
    const priorities = currentConfig.ProcessDefaults.DefaultPriorities || [];
    const currentValueIdx = priorities.findIndex((val) => val.exe === exe);
    const newValue: CpuPriorityRule = { exe, priority };
    if (currentValueIdx !== -1) {
      priorities[currentValueIdx] = newValue;
    } else {
      priorities.unshift(newValue);
    }
    currentConfig.ProcessDefaults.DefaultPriorities = priorities;
    return await setProcessLassoConfig(currentConfig);
}

export const removeCpuPriority = async(exe: string) => {
    const currentConfig = await getProcessLassoConfig();
    currentConfig.ProcessDefaults = currentConfig.ProcessDefaults || EMPTY_PROCESS_DEFAULTS;
    const priorities = currentConfig.ProcessDefaults.DefaultPriorities || [];
    currentConfig.ProcessDefaults.DefaultPriorities = priorities.filter((value) => value.exe !== exe);
    return await setProcessLassoConfig(currentConfig);
}

// `order` is the full list of exe names in the desired order — entries with
// no CPU priority set are silently skipped, same as reorderCpuSets.
export const reorderCpuPriorities = async(order: string[]) => {
    const currentConfig = await getProcessLassoConfig();
    const priorities = currentConfig.ProcessDefaults?.DefaultPriorities || [];
    const byExe = new Map(priorities.map((rule) => [rule.exe, rule] as const));
    const reordered = order.map((exe) => byExe.get(exe)).filter((rule): rule is CpuPriorityRule => !!rule);
    const missing = priorities.filter((rule) => !order.includes(rule.exe));
    currentConfig.ProcessDefaults = currentConfig.ProcessDefaults || EMPTY_PROCESS_DEFAULTS;
    currentConfig.ProcessDefaults.DefaultPriorities = [...reordered, ...missing];
    return await setProcessLassoConfig(currentConfig);
}

// "Induce Performance Mode" is a plain membership flag (GamingMode's
// AutomaticGamingModeProcessPaths) rather than a value like the other
// per-process settings, so there's just one setter instead of set/remove.
export const setPerformanceModeInduce = async(exe: string, enabled: boolean) => {
    const currentConfig = await getProcessLassoConfig();
    currentConfig.GamingMode = currentConfig.GamingMode || { AutomaticGamingModeProcessPaths: [] };
    const list = new Set(currentConfig.GamingMode.AutomaticGamingModeProcessPaths || []);
    if (enabled) list.add(exe); else list.delete(exe);
    currentConfig.GamingMode.AutomaticGamingModeProcessPaths = Array.from(list);
    return await setProcessLassoConfig(currentConfig);
}

// Applies cores/IO priority/CPU priority/performance-mode to every exe in
// `exes` in a single read-modify-write cycle (bulk edit) — avoids the read/
// write race + wasted disk I/O of calling the individual setters once per
// process.
//
// cores/priority/cpuPriority are tri-state: undefined = leave untouched,
// null = explicitly remove from every listed exe, a value = set it. This
// distinction matters because two different callers need opposite defaults
// for "not specified" — a manual bulk edit leaves untouched fields alone,
// but re-applying an edited preset needs to clear whatever the preset no
// longer specifies (see applyPresetToMatching in ProcessLassoSection.tsx).
// performanceMode doesn't need the null sentinel since boolean already has
// three natural states (undefined/true/false).
export const bulkSetProcessRules = async(exes: string[], updates: { cores?: number[] | null; priority?: IoPriorityLevel | null; cpuPriority?: CpuPriorityLevel | null; performanceMode?: boolean }) => {
    const currentConfig = await getProcessLassoConfig();
    currentConfig.ProcessDefaults = currentConfig.ProcessDefaults || EMPTY_PROCESS_DEFAULTS;

    if (updates.cores !== undefined) {
      const cpuSets = currentConfig.ProcessDefaults.CPUSets || [];
      if (updates.cores === null) {
        currentConfig.ProcessDefaults.CPUSets = cpuSets.filter((rule) => !exes.includes(rule.exe));
      } else {
        const byExe = new Map(cpuSets.map((rule) => [rule.exe, rule] as const));
        for (const exe of exes) byExe.set(exe, { exe, cores: updates.cores });
        currentConfig.ProcessDefaults.CPUSets = Array.from(byExe.values());
      }
    }

    if (updates.priority !== undefined) {
      const ioPriorities = currentConfig.ProcessDefaults.DefaultIOPriorities || [];
      if (updates.priority === null) {
        currentConfig.ProcessDefaults.DefaultIOPriorities = ioPriorities.filter((rule) => !exes.includes(rule.exe));
      } else {
        const byExe = new Map(ioPriorities.map((rule) => [rule.exe, rule] as const));
        for (const exe of exes) byExe.set(exe, { exe, priority: updates.priority });
        currentConfig.ProcessDefaults.DefaultIOPriorities = Array.from(byExe.values());
      }
    }

    if (updates.cpuPriority !== undefined) {
      const priorities = currentConfig.ProcessDefaults.DefaultPriorities || [];
      if (updates.cpuPriority === null) {
        currentConfig.ProcessDefaults.DefaultPriorities = priorities.filter((rule) => !exes.includes(rule.exe));
      } else {
        const byExe = new Map(priorities.map((rule) => [rule.exe, rule] as const));
        for (const exe of exes) byExe.set(exe, { exe, priority: updates.cpuPriority });
        currentConfig.ProcessDefaults.DefaultPriorities = Array.from(byExe.values());
      }
    }

    if (updates.performanceMode !== undefined) {
      currentConfig.GamingMode = currentConfig.GamingMode || { AutomaticGamingModeProcessPaths: [] };
      const list = new Set(currentConfig.GamingMode.AutomaticGamingModeProcessPaths || []);
      for (const exe of exes) {
        if (updates.performanceMode) list.add(exe); else list.delete(exe);
      }
      currentConfig.GamingMode.AutomaticGamingModeProcessPaths = Array.from(list);
    }

    return await setProcessLassoConfig(currentConfig);
}

export const processLassoAvailable = (): boolean => fs.existsSync(PROCESS_LASSO_CONFIG_FILE);