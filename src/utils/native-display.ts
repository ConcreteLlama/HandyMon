import fs from 'fs';
import path from 'path';
import { runPsScriptJson } from './windows';
import { NATIVE_DIR } from './dirs';

// Replaces the MonitorSwitcher.exe dependency with direct calls to Windows'
// CCD (Connecting and Configuring Displays) API — QueryDisplayConfig to
// capture the current monitor layout, SetDisplayConfig to reapply a saved
// one. Same architecture as native-audio.ts: all struct/P-Invoke work lives
// in C# — source in native-src/display-interop.cs, compiled entirely ahead
// of time by scripts/compile-native.js (never at runtime), PowerShell just
// loads the resulting DLL and calls plain static methods.
//
// Attribution: the DISPLAYCONFIG_* struct layouts, and the LUID-remap-at-
// apply-time approach (adapter LUIDs go stale across reboots/driver restarts;
// the fix is to re-resolve them at apply time against a fresh live query,
// matched by the path's stable numeric target/source Id rather than the
// volatile LUID) are adapted from mastersign/Mastersign.DisplayManager
// (MIT License, Copyright (c) 2017 Tobias Kiertscher):
// https://github.com/mastersign/Mastersign.DisplayManager
const DLL_PATH = path.join(NATIVE_DIR, 'display-interop.dll');

function ensureDllExists(): void {
  if (!fs.existsSync(DLL_PATH)) {
    throw new Error(`display-interop.dll not found at ${DLL_PATH} — run \`npm run compile-native\` first`);
  }
}


function loadPreamble(): string {
  const dll = DLL_PATH.replace(/\\/g, '\\\\');
  return `Add-Type -Path "${dll}"`;
}

export interface CapturedDisplayProfile {
  // Opaque JSON blob — captured native struct data, only meaningful to
  // native-display.ts's own Apply/Validate. Not intended to be read/edited
  // by anything else.
  json: string;
}

export async function captureDisplayConfig(excludeTargetIds: number[] = []): Promise<CapturedDisplayProfile> {
  ensureDllExists();
  const csv = excludeTargetIds.join(',');
  const script = `${loadPreamble()}\n[HandyMonDisplay.Api]::Capture("${csv}")`;
  const json = await runPsScriptJson<string>(`${script} | ConvertTo-Json -Compress`, 8000);
  return { json };
}

// A captured profile's JSON, once PS-escaped and base64-encoded for
// -EncodedCommand, can push a multi-monitor setup close to (or over)
// cmd.exe's 8KB command-line limit — the same limit that forced the C#
// source itself out of the encoded command text. Same fix: write the JSON to
// a file and have PowerShell read it via Get-Content, keeping the encoded
// script small regardless of profile size.
function writeProfileToTemp(json: string): string {
  fs.mkdirSync(NATIVE_DIR, { recursive: true });
  const tmpPath = path.join(NATIVE_DIR, `profile-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmpPath, json, 'utf-8');
  return tmpPath;
}

async function runWithProfileFile(profile: CapturedDisplayProfile, methodCall: string): Promise<{ ok: boolean; hresult: number }> {
  ensureDllExists();
  const tmpPath = writeProfileToTemp(profile.json);
  try {
    const escTmp = tmpPath.replace(/\\/g, '\\\\');
    const script = `${loadPreamble()}\n$json = Get-Content "${escTmp}" -Raw\n[HandyMonDisplay.Api]::${methodCall}`;
    const hresult = await runPsScriptJson<number>(`${script} | ConvertTo-Json -Compress`, 8000);
    return { ok: hresult === 0, hresult };
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

// Windows' ERROR_BAD_CONFIGURATION — SetDisplayConfig refused the exact
// captured config as-is (e.g. the driver reports slightly different mode
// timing after a reboot) but might succeed if allowed to adjust minor
// details. Callers use this to decide whether offering a "retry with
// adjustments" option makes sense, versus a plain failure.
export const ERROR_BAD_CONFIGURATION = 1610;

// Tries the exact captured config first (no changes allowed — most faithful
// to what was saved). Pass allowChanges only as a deliberate fallback after
// a first attempt fails with ERROR_BAD_CONFIGURATION, not as the default.
export async function applyDisplayConfig(profile: CapturedDisplayProfile, allowChanges = false): Promise<{ ok: boolean; hresult: number }> {
  return runWithProfileFile(profile, `Apply($json, $${allowChanges ? 'true' : 'false'})`);
}

export async function validateDisplayConfig(profile: CapturedDisplayProfile): Promise<{ ok: boolean; hresult: number }> {
  return runWithProfileFile(profile, 'Validate($json)');
}

export interface NativeDisplayDetail {
  TargetId: number;
  FriendlyName: string | null;
  OutputTechnology: number;
  Rotation: number;
  Width: number;
  Height: number;
  RefreshRate: number;
  HdrSupported: boolean;
  HdrEnabled: boolean;
  BitsPerColorChannel: number;
  ColorEncoding: number;
}

export async function getDisplayDetails(): Promise<NativeDisplayDetail[]> {
  ensureDllExists();
  const script = `${loadPreamble()}\n[HandyMonDisplay.Api]::GetDisplayDetails()`;
  const json = await runPsScriptJson<string>(`${script} | ConvertTo-Json -Compress`, 8000);
  return JSON.parse(json) as NativeDisplayDetail[];
}

// A LUID-independent signature for a captured profile's json — see the C#
// Fingerprint() doc comment. Used to detect which saved profile (if any)
// matches the currently active layout.
export async function fingerprintDisplayConfig(profile: CapturedDisplayProfile): Promise<string> {
  ensureDllExists();
  const tmpPath = writeProfileToTemp(profile.json);
  try {
    const escTmp = tmpPath.replace(/\\/g, '\\\\');
    const script = `${loadPreamble()}\n$json = Get-Content "${escTmp}" -Raw\n[HandyMonDisplay.Api]::Fingerprint($json)`;
    return await runPsScriptJson<string>(`${script} | ConvertTo-Json -Compress`, 8000);
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

// Decodes a saved profile's own stored data (no live query) into the same
// shape getDisplayDetails() returns for the live layout.
export async function describeDisplayConfig(profile: CapturedDisplayProfile): Promise<NativeDisplayDetail[]> {
  ensureDllExists();
  const tmpPath = writeProfileToTemp(profile.json);
  try {
    const escTmp = tmpPath.replace(/\\/g, '\\\\');
    const script = `${loadPreamble()}\n$json = Get-Content "${escTmp}" -Raw\n[HandyMonDisplay.Api]::DescribeProfile($json)`;
    const json = await runPsScriptJson<string>(`${script} | ConvertTo-Json -Compress`, 8000);
    return JSON.parse(json) as NativeDisplayDetail[];
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}
