import fs from 'fs';
import path from 'path';
import { runPsScriptJson } from './windows';
import { NATIVE_DIR } from './dirs';

// Replaces the SoundVolumeView.exe dependency with direct Windows Core Audio
// COM interop (documented IMMDeviceEnumerator/IAudioEndpointVolume for
// enumeration/volume, the undocumented-but-stable-on-Win10/11 IPolicyConfig
// for setting the default device — the same mechanism SoundVolumeView,
// EarTrumpet, and NirCmd all use internally).
//
// PowerShell can't dispatch to these interfaces directly (they're raw vtable
// COM interfaces with no IDispatch support, and PowerShell's dynamic binder
// only speaks IDispatch), so all interface calls happen inside compiled C#;
// PowerShell only ever calls simple static methods that take/return plain
// data. The source lives in native-src/audio-interop.cs and is compiled
// entirely ahead of time by scripts/compile-native.js — never at runtime —
// see dirs.ts's NATIVE_DIR for where the compiled DLL is expected to be.
const DLL_PATH = path.join(NATIVE_DIR, 'audio-interop.dll');

function ensureDllExists(): void {
  if (!fs.existsSync(DLL_PATH)) {
    throw new Error(`audio-interop.dll not found at ${DLL_PATH} — run \`npm run compile-native\` first`);
  }
}


function loadPreamble(): string {
  const dll = DLL_PATH.replace(/\\/g, '\\\\');
  return `Add-Type -Path "${dll}"`;
}

export interface NativeDeviceInfo {
  Id: string;
  Name: string;
  DeviceName: string;
  VolumePercent: number;
  IsDefault: boolean;
}

export async function listRenderDevices(): Promise<NativeDeviceInfo[]> {
  ensureDllExists();
  const script = `${loadPreamble()}\n[HandyMonAudio.Api]::ListRenderDevices() | ConvertTo-Json -Compress`;
  const raw = await runPsScriptJson<unknown>(script, 8000);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list as NativeDeviceInfo[];
}

export async function setNativeVolume(deviceId: string, percent: number): Promise<void> {
  ensureDllExists();
  const script = `${loadPreamble()}\n[HandyMonAudio.Api]::SetVolume("${deviceId}", ${percent})`;
  await runPsScriptJson<unknown>(`${script}\n"ok" | ConvertTo-Json -Compress`, 5000);
}

// role: 0 = eConsole, 1 = eMultimedia, 2 = eCommunications
export async function setNativeDefaultEndpoint(deviceId: string, role: number): Promise<void> {
  ensureDllExists();
  const script = `${loadPreamble()}\n[HandyMonAudio.Api]::SetDefaultEndpoint("${deviceId}", ${role})`;
  await runPsScriptJson<unknown>(`${script}\n"ok" | ConvertTo-Json -Compress`, 5000);
}
