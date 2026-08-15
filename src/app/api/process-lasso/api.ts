import { CpuPriorityLevel, IoPriorityLevel, ProcessLassoRuntimeConfig } from "@/utils/proces-lasso/process-lasso";
import { apiFetch } from "@/utils/api-client";

export const ProcessLassoApi = {
    availability: () => apiFetch<{ available: boolean; coreCount: number }>(`/api/process-lasso/availability`),
    config: {
        get: () => apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config`),
        cpuSets: {
            set: (processName: string, cores: number[]) =>
                apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/cpu-sets/${processName}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cores }),
                }),
            remove: (processName: string) =>
                apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/cpu-sets/${processName}`, { method: 'DELETE' }),
            reorder: (order: string[]) =>
                apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/cpu-sets/reorder`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }),
                }),
        },
        ioPriorities: {
            set: (processName: string, priority: IoPriorityLevel) =>
                apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/io-priorities/${processName}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority }),
                }),
            remove: (processName: string) =>
                apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/io-priorities/${processName}`, { method: 'DELETE' }),
            reorder: (order: string[]) =>
                apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/io-priorities/reorder`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }),
                }),
        },
        cpuPriorities: {
            set: (processName: string, priority: CpuPriorityLevel) =>
                apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/cpu-priorities/${processName}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority }),
                }),
            remove: (processName: string) =>
                apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/cpu-priorities/${processName}`, { method: 'DELETE' }),
            reorder: (order: string[]) =>
                apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/cpu-priorities/reorder`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }),
                }),
        },
        performanceMode: {
            set: (processName: string) =>
                apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/performance-mode/${processName}`, { method: 'POST' }),
            remove: (processName: string) =>
                apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/performance-mode/${processName}`, { method: 'DELETE' }),
        },
        // undefined = leave this field untouched on every selected process;
        // null = explicitly clear it (distinct from undefined, since a
        // manual bulk edit needs "don't touch" but re-applying an edited
        // preset needs "clear whatever this preset no longer specifies").
        bulkSet: (exes: string[], updates: { cores?: number[] | null; priority?: IoPriorityLevel | null; cpuPriority?: CpuPriorityLevel | null; performanceMode?: boolean }) =>
            apiFetch<ProcessLassoRuntimeConfig>(`/api/process-lasso/config/bulk`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exes, ...updates }),
            }),
    }
}