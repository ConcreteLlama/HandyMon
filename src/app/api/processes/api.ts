import { RunningProcess } from "@/types/processes";
import { apiFetch } from "@/utils/api-client";

export const ProcessesApi = {
    list: () => apiFetch<{ processes: RunningProcess[] }>(`/api/processes/list`),
}