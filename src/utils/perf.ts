import { encodePsScript } from '@/utils/windows';
import { exec } from 'child_process';
import { promisify } from 'util';
import { type PerfAdvancedSnapshot, type PerfSnapshot } from '@/types/perf';

const execAsync = promisify(exec);

// ── Native Windows Performance Counters ──────────────────────────────────────
// GPU counters require Win10 1803+ with WDDM 2.x driver.
// VRAM total: qwMemorySize is the 64-bit registry key (MemorySize caps at ~4GB).

const PERF_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'

$os  = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$totalRamMb  = [math]::Round($os.TotalVisibleMemorySize / 1024)
$logicalCores = $cpu.NumberOfLogicalProcessors

$counters = @(
  '\\Processor(*)\\% Processor Time',
  '\\Memory\\Available MBytes',
  '\\GPU Engine(*)\\Utilization Percentage',
  '\\GPU Adapter Memory(*)\\Dedicated Usage'
)
$samples = (Get-Counter -Counter $counters -SampleInterval 1 -MaxSamples 1 -ErrorAction SilentlyContinue).CounterSamples

$cpuSamples = $samples | Where-Object { $_.Path -like '*\\processor(*)\\% processor time' }
$cpuOverall = ($cpuSamples | Where-Object { $_.InstanceName -eq '_total' } | Select-Object -First 1).CookedValue
$cpuCores   = @($cpuSamples | Where-Object { $_.InstanceName -ne '_total' } | Sort-Object { [int]($_.InstanceName) } | ForEach-Object { [math]::Round($_.CookedValue, 1) })

$availMb   = ($samples | Where-Object { $_.Path -like '*\\memory\\available mbytes' } | Select-Object -First 1).CookedValue
$usedRamMb = $totalRamMb - [math]::Round($availMb)

$gpuUtilSamples = $samples | Where-Object { $_.Path -like '*\\gpu engine(*)\\utilization percentage' }
$gpuUtil = if ($gpuUtilSamples) { [math]::Round(($gpuUtilSamples | Measure-Object CookedValue -Maximum).Maximum, 1) } else { 0 }

$vramSamples    = $samples | Where-Object { $_.Path -like '*\\gpu adapter memory(*)\\dedicated usage' } | Where-Object { $_.CookedValue -gt 0 }
$dedicatedVramMb = if ($vramSamples) { [math]::Round(($vramSamples | Measure-Object CookedValue -Maximum).Maximum / 1MB) } else { 0 }

# 64-bit VRAM total from driver registry (qwMemorySize avoids 32-bit UInt cap of ~4GB)
$totalVramMb = 0
foreach ($i in 0..7) {
  $key = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\$('{0:D4}' -f $i)"
  try {
    $v = (Get-ItemProperty $key -Name 'HardwareInformation.qwMemorySize' -ErrorAction Stop).'HardwareInformation.qwMemorySize'
    if ($v -gt $totalVramMb) { $totalVramMb = [math]::Round($v / 1MB) }
  } catch {}
}

[PSCustomObject]@{
  cpuOverall      = [math]::Round($cpuOverall, 1)
  cpuCores        = $cpuCores
  usedRamMb       = $usedRamMb
  totalRamMb      = $totalRamMb
  gpuUtil         = $gpuUtil
  dedicatedVramMb = $dedicatedVramMb
  totalVramMb     = $totalVramMb
} | ConvertTo-Json -Compress
`.trim();

const ENCODED_PERF_SCRIPT = encodePsScript(PERF_SCRIPT);

// Fast RAM-only script — no Get-Counter, just WMI (~100ms vs ~1200ms)
const RAM_SCRIPT = `
$os = Get-CimInstance Win32_OperatingSystem
[PSCustomObject]@{
  usedRamMb  = [math]::Round($os.TotalVisibleMemorySize / 1024) - [math]::Round($os.FreePhysicalMemory / 1024)
  totalRamMb = [math]::Round($os.TotalVisibleMemorySize / 1024)
} | ConvertTo-Json -Compress
`.trim();

const ENCODED_RAM_SCRIPT = encodePsScript(RAM_SCRIPT);

export async function collectNativeStats(): Promise<Omit<PerfSnapshot, 'sensorsAvailable' | 'fpsAvailable'>> {
  const { stdout } = await execAsync(
    `powershell -NoProfile -NonInteractive -EncodedCommand ${ENCODED_PERF_SCRIPT}`,
    { timeout: 12000, maxBuffer: 1 * 1024 * 1024 }
  );
  const raw = JSON.parse(stdout.trim());
  return {
    timestamp: Date.now(),
    cpu: {
      overall: raw.cpuOverall ?? 0,
      cores: Array.isArray(raw.cpuCores) ? raw.cpuCores : [],
    },
    ram: {
      usedMb: raw.usedRamMb ?? 0,
      totalMb: raw.totalRamMb ?? 0,
    },
    gpu: {
      utilization: raw.gpuUtil ?? 0,
      dedicatedVramMb: raw.dedicatedVramMb ?? 0,
      totalVramMb: raw.totalVramMb ?? 0,
    },
  };
}

export async function collectRamOnly(): Promise<{ usedMb: number; totalMb: number }> {
  const { stdout } = await execAsync(
    `powershell -NoProfile -NonInteractive -EncodedCommand ${ENCODED_RAM_SCRIPT}`,
    { timeout: 5000, maxBuffer: 64 * 1024 }
  );
  const raw = JSON.parse(stdout.trim());
  return { usedMb: raw.usedRamMb ?? 0, totalMb: raw.totalRamMb ?? 0 };
}

// ── Advanced stats (disk I/O, network I/O, top processes) ────────────────────
// Uses Win32_PerfFormattedData WMI classes — no Get-Counter sampling delay.

const ADVANCED_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'

$cpuCount = (Get-CimInstance Win32_Processor | Measure-Object NumberOfLogicalProcessors -Sum).Sum

$disk = Get-CimInstance Win32_PerfFormattedData_PerfDisk_LogicalDisk | Where-Object { $_.Name -eq '_Total' }
$diskReadMbps  = if ($disk) { [math]::Round($disk.DiskReadBytesPersec  / 1MB, 2) } else { 0 }
$diskWriteMbps = if ($disk) { [math]::Round($disk.DiskWriteBytesPersec / 1MB, 2) } else { 0 }

$nets = @(Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface)
$netRecvMbps = if ($nets) { [math]::Round(($nets | Measure-Object BytesReceivedPersec -Sum).Sum / 1MB, 3) } else { 0 }
$netSentMbps = if ($nets) { [math]::Round(($nets | Measure-Object BytesSentPersec    -Sum).Sum / 1MB, 3) } else { 0 }

$procs = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process |
  Where-Object { $_.Name -notmatch '^(_Total|Idle)$' } |
  Group-Object { $_.Name -replace '#\\d+$', '' } |
  ForEach-Object {
    [PSCustomObject]@{
      name       = $_.Name
      cpuPercent = [math]::Round(($_.Group | Measure-Object PercentProcessorTime -Sum).Sum / $cpuCount, 1)
      ramMb      = [math]::Round(($_.Group | Measure-Object WorkingSet -Sum).Sum / 1MB)
    }
  } |
  Sort-Object cpuPercent -Descending |
  Select-Object -First 8

$pf = Get-CimInstance Win32_PageFileUsage | Select-Object -First 1
$pagefileTotalMb = if ($pf) { $pf.AllocatedBaseSize } else { $null }
$pagefileUsedMb  = if ($pf) { $pf.CurrentUsage }      else { $null }

[PSCustomObject]@{
  diskReadMbps     = $diskReadMbps
  diskWriteMbps    = $diskWriteMbps
  netRecvMbps      = $netRecvMbps
  netSentMbps      = $netSentMbps
  pagefileTotalMb  = $pagefileTotalMb
  pagefileUsedMb   = $pagefileUsedMb
  topProcesses     = @($procs)
} | ConvertTo-Json -Compress -Depth 3
`.trim();

const ENCODED_ADVANCED_SCRIPT = encodePsScript(ADVANCED_SCRIPT);

// ── Capture-time IO sample (disk, network, RAM — no top-processes/pagefile) ──
// A leaner sibling of ADVANCED_SCRIPT for capture-sensors.ts's once-a-second
// sampler: skips the per-process WMI group-by (the most expensive part of
// ADVANCED_SCRIPT) and pagefile, since neither matters for "what was the
// system doing when this hitch happened" — keeps each tick to one cheap
// PowerShell spawn instead of piling one of these up alongside collectRamOnly.

const CAPTURE_IO_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'

$os = Get-CimInstance Win32_OperatingSystem
$disk = Get-CimInstance Win32_PerfFormattedData_PerfDisk_LogicalDisk | Where-Object { $_.Name -eq '_Total' }
$nets = @(Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface)

[PSCustomObject]@{
  ramUsedMb     = [math]::Round($os.TotalVisibleMemorySize / 1024) - [math]::Round($os.FreePhysicalMemory / 1024)
  diskReadMbps  = if ($disk) { [math]::Round($disk.DiskReadBytesPersec  / 1MB, 2) } else { 0 }
  diskWriteMbps = if ($disk) { [math]::Round($disk.DiskWriteBytesPersec / 1MB, 2) } else { 0 }
  netRecvMbps   = if ($nets) { [math]::Round(($nets | Measure-Object BytesReceivedPersec -Sum).Sum / 1MB, 3) } else { 0 }
  netSentMbps   = if ($nets) { [math]::Round(($nets | Measure-Object BytesSentPersec    -Sum).Sum / 1MB, 3) } else { 0 }
} | ConvertTo-Json -Compress
`.trim();

const ENCODED_CAPTURE_IO_SCRIPT = encodePsScript(CAPTURE_IO_SCRIPT);

export interface CaptureIoSample {
  ramUsedMb: number;
  diskReadMbps: number;
  diskWriteMbps: number;
  netRecvMbps: number;
  netSentMbps: number;
}

export async function collectCaptureIoSample(): Promise<CaptureIoSample> {
  const { stdout } = await execAsync(
    `powershell -NoProfile -NonInteractive -EncodedCommand ${ENCODED_CAPTURE_IO_SCRIPT}`,
    { timeout: 5000, maxBuffer: 64 * 1024 }
  );
  const raw = JSON.parse(stdout.trim());
  return {
    ramUsedMb: raw.ramUsedMb ?? 0,
    diskReadMbps: raw.diskReadMbps ?? 0,
    diskWriteMbps: raw.diskWriteMbps ?? 0,
    netRecvMbps: raw.netRecvMbps ?? 0,
    netSentMbps: raw.netSentMbps ?? 0,
  };
}

export async function collectAdvancedStats(): Promise<PerfAdvancedSnapshot> {
  const { stdout } = await execAsync(
    `powershell -NoProfile -NonInteractive -EncodedCommand ${ENCODED_ADVANCED_SCRIPT}`,
    { timeout: 10000, maxBuffer: 256 * 1024 }
  );
  const raw = JSON.parse(stdout.trim());
  const procs = Array.isArray(raw.topProcesses)
    ? raw.topProcesses.map((p: { name: string; cpuPercent: number; ramMb: number }) => ({
        name: String(p.name ?? ''),
        cpuPercent: Number(p.cpuPercent ?? 0),
        ramMb: Number(p.ramMb ?? 0),
      }))
    : [];
  const pagefile = raw.pagefileTotalMb != null
    ? { usedMb: Number(raw.pagefileUsedMb ?? 0), totalMb: Number(raw.pagefileTotalMb) }
    : null;
  return {
    timestamp: Date.now(),
    disk:    { readMbps:  raw.diskReadMbps  ?? 0, writeMbps: raw.diskWriteMbps ?? 0 },
    network: { recvMbps:  raw.netRecvMbps   ?? 0, sentMbps:  raw.netSentMbps  ?? 0 },
    pagefile,
    topProcesses: procs,
  };
}
