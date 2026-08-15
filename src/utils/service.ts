import { execCommand } from "./command"
import { runPsScriptJson } from "./windows"

type ServiceType = 'service' | 'task';

const makeTaskCmd = (serviceName: string, action: 'run' | 'end') => `schtasks /${action} /tn "${serviceName}"`;
const makeServiceCmd = (serviceName: string, action: 'start' | 'stop') => `net ${action} "${serviceName}"`;
export const makeServiceStartCmd = (serviceName: string, type: ServiceType) =>
    type === 'service' ? makeServiceCmd(serviceName, 'start') : makeTaskCmd(serviceName, 'run');
export const makeServiceEndCmd = (serviceName: string, type: ServiceType) =>
    type === 'service' ? makeServiceCmd(serviceName, 'stop') : makeTaskCmd(serviceName, 'end');

// Queries the OS's own record of whether a service/task is running (SCM for
// services, Task Scheduler for tasks) rather than inferring it from a process
// name — a process name can be wrong (shared host processes, name reuse) and
// requires the admin to know/type an .exe that the OS already tracks for us.
export const isServiceRunning = async (serviceName: string, type: ServiceType): Promise<boolean> => {
    try {
        const status = type === 'service'
            ? await runPsScriptJson<string>(`(Get-Service -Name "${serviceName}" -ErrorAction Stop).Status.ToString() | ConvertTo-Json -Compress`, 5000)
            : await runPsScriptJson<string>(`(Get-ScheduledTask -TaskName "${serviceName}" -ErrorAction Stop).State.ToString() | ConvertTo-Json -Compress`, 5000);
        return status === 'Running';
    } catch {
        return false;
    }
}

export const waitForServiceStatus = async (
    serviceName: string,
    type: ServiceType,
    toBe: 'started' | 'stopped',
    waitTime: number = 10000,
    checkInterval: number = 400,
): Promise<boolean> => {
    const startTime = Date.now();
    while (Date.now() - startTime < waitTime) {
        const running = await isServiceRunning(serviceName, type);
        if (toBe === 'started' ? running : !running) return running;
        await new Promise((res) => setTimeout(res, checkInterval));
    }
    return isServiceRunning(serviceName, type);
}

export const makeService = (startCmd: string, stopCmd: string, serviceName: string, type: ServiceType, defaultDelay: number = 2000) => {
    const start = async (waitForStart: number = 0) => {
        const result = await execCommand(startCmd);
        const running = waitForStart > 0 ? await waitForServiceStatus(serviceName, type, 'started', waitForStart) : undefined;
        return {
            startCommandOutput: result,
            running,
        }
    }
    const stop = async (waitForStop: number = 0) => {
        const result = await execCommand(stopCmd);
        const running = waitForStop > 0 ? await waitForServiceStatus(serviceName, type, 'stopped', waitForStop) : undefined;
        return {
            startCommandOutput: result,
            running,
        }
    }
    return {
        start,
        stop,
        restart: async (delay: number = defaultDelay) => {
            const stopResult = await stop();
            await new Promise((resolve) => setTimeout(resolve, delay));
            const startResult = await start();
            return {
                stopResult,
                startResult,
            }
        },
        isRunning: () => isServiceRunning(serviceName, type),
    }
}
export type ServiceController = ReturnType<typeof makeService>;

export const makeServiceFromName = (serviceName: string, type: ServiceType, restartDelay: number = 2000) =>
    makeService(makeServiceStartCmd(serviceName, type), makeServiceEndCmd(serviceName, type), serviceName, type, restartDelay);
