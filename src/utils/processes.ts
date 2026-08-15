import { ProcessDetail, ProcessUsage, RunningProcess } from '@/types/processes';
import { runPsScriptJson } from '@/utils/windows';
import { queryNativeWorker } from '@/utils/native-worker';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Fast per-PID CPU% + RAM via WMI perf counters (no sampling delay). Runs
// through the persistent native worker (see native-worker.ts) instead of
// spawning PowerShell — this is polled every 2.5s while the Processes tab is
// open, so it's exactly the kind of call that shouldn't pay a fresh
// powershell.exe spawn (plus, previously, an Add-Type recompile) every tick.
export async function getProcessUsage(): Promise<ProcessUsage[]> {
  try {
    const raw = await queryNativeWorker<any[]>('processUsage', 8000);
    return (raw ?? [])
      .map(r => ({ pid: Number(r.pid), name: String(r.name ?? ''), cpu: Number(r.cpu) || 0, ram: Number(r.ram) || 0, startTime: r.startTime != null ? Number(r.startTime) : null }))
      .filter(p => p.pid);
  } catch {
    return [];
  }
}

export async function getProcessDetail(pid: number): Promise<ProcessDetail | null> {
  const script = `
$ErrorActionPreference='SilentlyContinue'
$id = ${Math.trunc(pid)}
$p = Get-Process -Id $id
if (-not $p) { exit }
$w = Get-CimInstance Win32_Process -Filter "ProcessId=$id"
[PSCustomObject]@{
  pid         = $id
  name        = $p.Name
  path        = $p.Path
  commandLine = $w.CommandLine
  ramMb       = [math]::Round($p.WorkingSet64 / 1MB)
  cpuSeconds  = if ($p.CPU) { [math]::Round($p.CPU, 1) } else { $null }
  threads     = $p.Threads.Count
  startTime   = if ($p.StartTime) { [int64]([DateTimeOffset]$p.StartTime).ToUnixTimeMilliseconds() } else { $null }
} | ConvertTo-Json -Compress
`.trim();
  try {
    const r = await runPsScriptJson<any>(script, 6000);
    if (!r || !r.pid) return null;
    return {
      pid: Number(r.pid),
      name: String(r.name ?? ''),
      path: r.path ?? null,
      commandLine: r.commandLine ?? null,
      ramMb: Number(r.ramMb) || 0,
      cpuSeconds: r.cpuSeconds != null ? Number(r.cpuSeconds) : null,
      threads: r.threads != null ? Number(r.threads) : null,
      startTime: r.startTime != null ? Number(r.startTime) : null,
    };
  } catch {
    return null;
  }
}

export const parseDotNetDate = (ssStr: string): number | null => {
  const match = ssStr?.match(/\/Date\((\d+)\)\//);
  return match ? Number(match[1]) : null;
};

export const listRunningProcesses = async (): Promise<RunningProcess[]> => {
  try {
    const sample = async () => {
      const psCommand = `powershell -NoProfile -Command "Get-Process | Select-Object Name,Id,StartTime,@{Name='CPU';Expression={$_.CPU}} | ConvertTo-Json"`;
      const { stdout } = await execAsync(psCommand, { maxBuffer: 1024 * 500 });
      const parsed = JSON.parse(stdout);
      const list = Array.isArray(parsed) ? parsed : [parsed];

      return list.map((p: any) => ({
        name: p.Name,
        exeName: p.Name.endsWith('.exe') ? p.Name : `${p.Name}.exe`,
        pid: p.Id,
        cpu: parseFloat(p.CPU) || 0,
        startTime: parseDotNetDate(p.StartTime),
      }));
    };

    const [first, second] = await Promise.all([
      sample(),
      new Promise<RunningProcess[]>((resolve) => {
        setTimeout(async () => resolve(await sample()), 1000);
      }),
    ]);

    const cpuMap = new Map(first.map(p => [p.pid, p]));

    const logicalCores = require('os').cpus().length;

    return second.map(p2 => {
      const p1 = cpuMap.get(p2.pid);
      const deltaCpu = p2 ? ((p2.cpu || 0) - (p1?.cpu || 0)) : 0;
      const cpuPercent = Math.min(100, (deltaCpu * 100) / 1 / logicalCores); // over 1s window
      return {
        ...p2,
        cpu: Number(cpuPercent.toFixed(2)),
      };
    });
  } catch (err) {
    console.error('Failed to sample processes:', err);
    return [];
  }
};


export const listRunningProcessNames = async (): Promise<string[]> => {
    try {
        const psCommand = `powershell -NoProfile -Command "Get-Process | Select-Object -ExpandProperty Name | Sort-Object -Unique"`;
        const { stdout } = await execAsync(psCommand, { maxBuffer: 1024 * 500 });

        return stdout
            .split(/\r?\n/)
            .map(name => name.trim())
            .filter(name => name.length > 0);
    } catch (err) {
        console.error('Failed to list process names:', err);
        return [];
    }
};