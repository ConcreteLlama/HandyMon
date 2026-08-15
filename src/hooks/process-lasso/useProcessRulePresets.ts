import { useAppConfig, useUpdateAppConfig } from '@/hooks/config/useAppConfig';
import { ProcessRulePreset } from '@/types/app-config';
import { CpuPriorityLevel, IoPriorityLevel } from '@/utils/proces-lasso/process-lasso';
import { toKebabId } from '@/utils/id';

export function useProcessRulePresets() {
  const { data: config } = useAppConfig();
  return config?.processRulePresets ?? [];
}

// `editId` updates an existing preset in place (keeping its id) instead of
// creating a new one — lets "rename/redefine this preset" cascade to
// whatever already references it, rather than forcing delete+recreate.
export function useSaveProcessRulePreset() {
  const { data: config } = useAppConfig();
  const update = useUpdateAppConfig();
  return (label: string, cores?: number[], ioPriority?: IoPriorityLevel, editId?: string, cpuPriority?: CpuPriorityLevel, performanceMode?: boolean) => {
    if (!config) return;
    const preset: ProcessRulePreset = { id: editId ?? `${toKebabId(label)}-${Date.now().toString(36)}`, label, cores, ioPriority, cpuPriority, performanceMode };
    const processRulePresets = editId
      ? config.processRulePresets.map(p => p.id === editId ? preset : p)
      : [...config.processRulePresets, preset];
    update.mutate({ ...config, processRulePresets });
  };
}

export function useDeleteProcessRulePreset() {
  const { data: config } = useAppConfig();
  const update = useUpdateAppConfig();
  return (id: string) => {
    if (!config) return;
    update.mutate({ ...config, processRulePresets: config.processRulePresets.filter(p => p.id !== id) });
  };
}
