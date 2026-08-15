export type RunningProcess = {
    name: string;
    exeName: string;
    pid: number;
    cpu: number | null;         // Total processor time in seconds (approx)
    startTime: number | null;   // ISO date string
};

export interface ProcessUsage {
    pid: number;
    name: string;
    cpu: number; // % of total CPU
    ram: number; // MB (working set)
    startTime: number | null; // unix ms
}

export interface ProcessDetail {
    pid: number;
    name: string;
    path: string | null;
    commandLine: string | null;
    ramMb: number;
    cpuSeconds: number | null;   // cumulative CPU time
    threads: number | null;
    startTime: number | null;    // unix ms
}
