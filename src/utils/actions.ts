import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { Action, SequenceStep, KeySequenceEvent } from '@/types/app-config';
import { buildDelayedFocusScript, buildScanAndFocusScript, runPsScript } from '@/utils/windows';
import { typeText } from '@/utils/virtual-keyboard';
import { setDisplayProfile } from '@/utils/display-profiles';
import { listAudioDevices, setDefaultAudioDevice, setVolume } from '@/utils/audio-devices';
import { setFanProfile } from '@/utils/fan-control';
import { getAppConfig } from '@/utils/app-config';
import { log } from '@/utils/logger';

const execAsync = promisify(exec);

type LaunchStep = Extract<SequenceStep, { type: 'launch' }>;
type HotkeyStep = Extract<SequenceStep, { type: 'hotkey' }>;
type KeySequenceStep = Extract<SequenceStep, { type: 'keysequence' }>;

export async function executeLaunchAction(step: LaunchStep): Promise<void> {
  const child = spawn(step.program, step.args ?? [], {
    detached: true, stdio: 'ignore', shell: false,
  });
  child.unref();

  if (step.autoFocus && child.pid != null) {
    await focusAfterLaunch(step, child.pid).catch(() => {});
  }
}

async function focusAfterLaunch(step: LaunchStep, spawnedPid: number): Promise<void> {
  const mode = step.focusMode ?? 'scan';
  const delay = step.focusDelay ?? 600;
  if (mode === 'delay') {
    await runPsScript(buildDelayedFocusScript(spawnedPid, delay), delay + 8000);
  } else {
    await runPsScript(buildScanAndFocusScript(spawnedPid), 15000);
  }
}

// ── Key mappings ──────────────────────────────────────────────────────────────

const MODIFIER_MAP: Record<string, string> = {
  Ctrl: '^', Control: '^', LCtrl: '^',
  Alt: '%', LAlt: '%',
  Shift: '+', LShift: '+',
  RCtrl: '^', RAlt: '%', RShift: '+', // SendKeys has no L/R distinction
};

const SENDKEYS_MAP: Record<string, string> = {
  Enter: '{ENTER}', Return: '{ENTER}',
  Escape: '{ESC}', Esc: '{ESC}',
  Tab: '{TAB}',
  Backspace: '{BACKSPACE}', BS: '{BACKSPACE}',
  Delete: '{DELETE}', Del: '{DELETE}',
  Insert: '{INSERT}', Ins: '{INSERT}',
  Home: '{HOME}', End: '{END}',
  PageUp: '{PGUP}', PgUp: '{PGUP}',
  PageDown: '{PGDN}', PgDn: '{PGDN}',
  Up: '{UP}', Down: '{DOWN}', Left: '{LEFT}', Right: '{RIGHT}',
  F1: '{F1}',  F2: '{F2}',  F3: '{F3}',  F4: '{F4}',
  F5: '{F5}',  F6: '{F6}',  F7: '{F7}',  F8: '{F8}',
  F9: '{F9}',  F10: '{F10}', F11: '{F11}', F12: '{F12}',
  F13: '{F13}', F14: '{F14}', F15: '{F15}', F16: '{F16}',
  Space: ' ',
  PrintScreen: '{PRTSC}',
  ScrollLock: '{SCROLLLOCK}',
  Pause: '{BREAK}',
  CapsLock: '{CAPSLOCK}',
  NumLock: '{NUMLOCK}',
  Numpad0: '{NUMPAD0}', Numpad1: '{NUMPAD1}', Numpad2: '{NUMPAD2}',
  Numpad3: '{NUMPAD3}', Numpad4: '{NUMPAD4}', Numpad5: '{NUMPAD5}',
  Numpad6: '{NUMPAD6}', Numpad7: '{NUMPAD7}', Numpad8: '{NUMPAD8}',
  Numpad9: '{NUMPAD9}',
  NumpadAdd: '{ADD}', NumpadSubtract: '{SUBTRACT}',
  NumpadMultiply: '{MULTIPLY}', NumpadDivide: '{DIVIDE}',
  NumpadDecimal: '{DECIMAL}',
};

// P/Invoke virtual key codes — only for keys that have no SendKeys or AppCmd equivalent
const VK_MAP: Record<string, number> = {
  Win: 0x5B, LWin: 0x5B, RWin: 0x5C,
  // Tab intentionally absent — handled by SendKeys {TAB}
  // Media/browser keys intentionally absent — handled by APP_CMD_MAP
};

// WM_APPCOMMAND values for media/browser keys.
// PostMessage to HWND_BROADCAST works from background processes; keybd_event does not.
const APP_CMD_MAP: Record<string, number> = {
  BrowserBack:     1,
  BrowserForward:  2,
  BrowserRefresh:  3,
  VolumeMute:      8,
  VolumeDown:      9,
  VolumeUp:        10,
  MediaNext:       11,
  MediaPrev:       12,
  MediaStop:       13,
  MediaPlayPause:  14,
};

// Full key-name → Windows virtual-key-code table, for the Key Sequence step
// (unlike Hotkey's atomic combo, a sequence needs a genuine keybd_event
// down/up per key, so every key in ActionsSection.tsx's ALL_KEYS catalogue
// needs a real VK code here — not just the Win-key subset VK_MAP covers).
// Standard documented Windows VK_* constants.
const FULL_VK_MAP: Record<string, number> = {
  Ctrl: 0xA2, Control: 0xA2, LCtrl: 0xA2, RCtrl: 0xA3,
  Alt: 0xA4, LAlt: 0xA4, RAlt: 0xA5,
  Shift: 0xA0, LShift: 0xA0, RShift: 0xA1,
  Win: 0x5B, LWin: 0x5B, RWin: 0x5C, Windows: 0x5B, Super: 0x5B, Meta: 0x5B,
  Escape: 0x1B, Esc: 0x1B, Enter: 0x0D, Return: 0x0D, Tab: 0x09, Space: 0x20,
  Backspace: 0x08, BS: 0x08, Delete: 0x2E, Del: 0x2E, Insert: 0x2D, Ins: 0x2D,
  Up: 0x26, Down: 0x28, Left: 0x25, Right: 0x27,
  Home: 0x24, End: 0x23, PageUp: 0x21, PgUp: 0x21, PageDown: 0x22, PgDn: 0x22,
  PrintScreen: 0x2C, ScrollLock: 0x91, Pause: 0x13, CapsLock: 0x14, NumLock: 0x90, Sleep: 0x5F,
  VolumeUp: 0xAF, VolumeDown: 0xAE, VolumeMute: 0xAD,
  MediaPlayPause: 0xB3, MediaNext: 0xB0, MediaPrev: 0xB1, MediaStop: 0xB2,
  BrowserBack: 0xA6, BrowserForward: 0xA7, BrowserRefresh: 0xA8,
  Numpad0: 0x60, Numpad1: 0x61, Numpad2: 0x62, Numpad3: 0x63, Numpad4: 0x64,
  Numpad5: 0x65, Numpad6: 0x66, Numpad7: 0x67, Numpad8: 0x68, Numpad9: 0x69,
  NumpadAdd: 0x6B, NumpadSubtract: 0x6D, NumpadMultiply: 0x6A, NumpadDivide: 0x6F, NumpadDecimal: 0x6E,
};

function keyNameToVkCode(key: string): number {
  if (key in FULL_VK_MAP) return FULL_VK_MAP[key];
  if (key.length === 1) return key.toUpperCase().charCodeAt(0); // letters/digits
  const fMatch = key.match(/^F(\d{1,2})$/i);
  if (fMatch) return 0x6F + parseInt(fMatch[1]); // F1=0x70 .. F16=0x7F
  throw new Error(`Cannot map key "${key}" to a virtual key code`);
}

// Special Win-key combos using native commands instead of P/Invoke.
// keybd_event with VK_LWIN is blocked by Windows UIAccess for system UI targets.
const WIN_COMBOS: Record<string, string> = {
  l:   'rundll32.exe user32.dll,LockWorkStation',
  e:   'explorer.exe',
  d:   `powershell -NoProfile -NonInteractive -Command "$sh = New-Object -ComObject Shell.Application; $sh.ToggleDesktop()"`,
  r:   'rundll32.exe shell32.dll,#61',
  i:   'explorer.exe ms-settings:',
  s:   'explorer.exe ms-search:',
  tab: 'rundll32.exe DwmApi.dll,#104',
};

// ── Execution ─────────────────────────────────────────────────────────────────

function buildAppCmdScript(appCmd: number): string {
  // PostMessage WM_APPCOMMAND to the foreground window — same as a physical media key
  return [
    `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam); [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();' -Name WM -Namespace PC`,
    `[PC.WM]::PostMessage([PC.WM]::GetForegroundWindow(), 0x319, [IntPtr]::Zero, [IntPtr](${appCmd * 65536}))`,
  ].join('; ');
}

function buildPInvokeScript(vkCodes: number[]): string {
  const downs = vkCodes.map(vk => `[PC.KB]::keybd_event(${vk}, 0, 0, [UIntPtr]::Zero)`).join('; ');
  const ups   = [...vkCodes].reverse().map(vk => `[PC.KB]::keybd_event(${vk}, 0, 2, [UIntPtr]::Zero)`).join('; ');
  return [
    'Add-Type -MemberDefinition \'[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr extra);\' -Name KB -Namespace PC',
    downs,
    'Start-Sleep -Milliseconds 50',
    ups,
  ].join('; ');
}

export async function executeHotkeyAction(step: HotkeyStep): Promise<void> {
  const { keys } = step;
  if (!keys.length) throw new Error('No keys specified');

  const WIN_ALIASES = new Set(['Win', 'Windows', 'LWin', 'RWin', 'Super', 'Meta']);
  const hasWin = keys.some(k => WIN_ALIASES.has(k));

  if (hasWin) {
    const rest = keys
      .filter(k => !WIN_ALIASES.has(k))
      .map(k => k.toLowerCase())
      .join('+');
    if (rest === '') {
      // Win alone → Ctrl+Esc (opens Start menu; Win key injection blocked by UIAccess)
      await executeHotkeyAction({ type: 'hotkey', keys: ['Ctrl', 'Escape'] });
      return;
    }
    const cmd = WIN_COMBOS[rest];
    if (cmd) { await execAsync(cmd); return; }
    // Fall through to P/Invoke for unknown Win combos
  }

  // Media / browser keys via WM_APPCOMMAND — works from background processes
  const appCmdKey = keys.find(k => k in APP_CMD_MAP);
  if (appCmdKey) {
    await runPsScript(buildAppCmdScript(APP_CMD_MAP[appCmdKey]));
    return;
  }

  // Determine if any remaining key needs P/Invoke (Win combos not in WIN_COMBOS)
  const needsVK = keys.some(k => k in VK_MAP || WIN_ALIASES.has(k));

  if (needsVK) {
    const vkCodes = keys.map(k => {
      if (WIN_ALIASES.has(k)) return VK_MAP.Win;
      if (k in VK_MAP) return VK_MAP[k];
      // Map SendKeys-style modifiers to VK codes
      if (k === 'Ctrl' || k === 'LCtrl' || k === 'RCtrl' || k === 'Control') return k === 'RCtrl' ? 0xA3 : 0xA2;
      if (k === 'Alt'  || k === 'LAlt'  || k === 'RAlt')  return k === 'RAlt'  ? 0xA5 : 0xA4;
      if (k === 'Shift'|| k === 'LShift'|| k === 'RShift') return k === 'RShift'? 0xA1 : 0xA0;
      // Letters / numbers
      if (k.length === 1) return k.toUpperCase().charCodeAt(0);
      // F keys
      const fMatch = k.match(/^F(\d{1,2})$/i);
      if (fMatch) return 0x6F + parseInt(fMatch[1]); // F1=0x70
      throw new Error(`Cannot map key "${k}" to a virtual key code`);
    });
    await runPsScript(buildPInvokeScript(vkCodes));
    return;
  }

  // Standard SendKeys path
  const modifiers = keys.filter(k => k in MODIFIER_MAP);
  const mainKeys  = keys.filter(k => !(k in MODIFIER_MAP));

  if (!mainKeys.length && !modifiers.length) throw new Error('No keys specified');

  const modStr = modifiers.map(k => MODIFIER_MAP[k]).join('');

  const mapKey = (k: string) =>
    SENDKEYS_MAP[k] ?? (k.length === 1 ? k.toLowerCase() : `{${k.toUpperCase()}}`);

  let sendKeys: string;
  if (!mainKeys.length) {
    sendKeys = modStr;
  } else if (mainKeys.length === 1) {
    sendKeys = modStr + mapKey(mainKeys[0]);
  } else {
    // Multiple main keys: apply modifiers to each in sequence
    const keyStr = mainKeys.map(mapKey).join('');
    sendKeys = modStr ? `${modStr}(${keyStr})` : keyStr;
  }

  const escaped = sendKeys.replace(/'/g, "''");
  await execAsync(
    `powershell -NoProfile -NonInteractive -Command "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys('${escaped}')"`
  );
}

// Builds ONE script for the whole event list (rather than one PowerShell
// process per event) so the down/wait/up timing is controlled by the script
// itself, not by Node round-trips + separate process-spawn latency between
// events. KEYEVENTF_KEYUP = 2; omitted (0) = key-down.
function buildKeySequenceScript(events: KeySequenceEvent[]): string {
  const lines = [
    'Add-Type -MemberDefinition \'[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr extra);\' -Name KB -Namespace PC',
  ];
  for (const e of events) {
    if (e.kind === 'down') lines.push(`[PC.KB]::keybd_event(${keyNameToVkCode(e.key)}, 0, 0, [UIntPtr]::Zero)`);
    else if (e.kind === 'up') lines.push(`[PC.KB]::keybd_event(${keyNameToVkCode(e.key)}, 0, 2, [UIntPtr]::Zero)`);
    else lines.push(`Start-Sleep -Milliseconds ${Math.max(0, Math.round(e.ms))}`);
  }
  return lines.join('; ');
}

export async function executeKeySequenceAction(step: KeySequenceStep): Promise<void> {
  const { events } = step;
  if (!events.length) throw new Error('No key sequence events specified');
  const totalWaitMs = events.reduce((sum, e) => sum + (e.kind === 'wait' ? e.ms : 0), 0);
  // Generous buffer over the sequence's own scripted wait time for
  // keybd_event/process overhead — if this timeout is ever hit mid-sequence,
  // any key already sent 'down' without a matching 'up' stays physically
  // pressed until released by hand, so this errs on the side of a long cap
  // rather than killing a script that's still legitimately running.
  await runPsScript(buildKeySequenceScript(events), Math.min(30000, totalWaitMs + 8000));
}

// ── Sequence execution ────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function executeAction(action: Action, allActions: Action[], depth = 0): Promise<string[]> {
  if (depth > 10) throw new Error('Maximum sequence depth exceeded');
  const warnings: string[] = [];
  for (const step of action.steps) {
    switch (step.type) {
      case 'delay':
        await sleep(step.ms);
        break;
      case 'hotkey':
        await executeHotkeyAction(step);
        break;
      case 'keysequence':
        await executeKeySequenceAction(step);
        break;
      case 'launch':
        await executeLaunchAction(step);
        break;
      case 'macro': {
        const ref = allActions.find(a => a.id === step.macroId);
        if (ref) warnings.push(...await executeAction(ref, allActions, depth + 1));
        break;
      }
      case 'text':
        if (step.text) await typeText(step.text);
        break;
      case 'display':
        if (!step.displayProfileId) break;
        try {
          const res = await setDisplayProfile(step.displayProfileId);
          if (!res.ok) { const msg = `Display switch failed: ${res.message}`; log.warn(msg); warnings.push(msg); }
        } catch (e: any) { const msg = `Display switch failed: ${e.message}`; log.warn(msg); warnings.push(msg); }
        break;
      case 'audio':
        if (!step.audioDeviceId) break;
        try {
          const config = getAppConfig();
          const deviceConfig = config.configuredAudioDevices.find(d => d.id === step.audioDeviceId);
          if (!deviceConfig) { const msg = `Configured audio device not found`; log.warn(msg); warnings.push(msg); break; }
          const devices = await listAudioDevices();
          const match = deviceConfig.matchValue.toLowerCase();
          const device = devices.available.find(d => d.name.toLowerCase().includes(match) || d.deviceName.toLowerCase().includes(match));
          if (!device) { const msg = `Audio device "${deviceConfig.name}" not found live`; log.warn(msg); warnings.push(msg); break; }
          await setDefaultAudioDevice(device.id, 'Multimedia');
          if (step.audioVolume != null) await setVolume(device.id, step.audioVolume);
        } catch (e: any) { const msg = `Audio switch failed: ${e.message}`; log.warn(msg); warnings.push(msg); }
        break;
      case 'fan':
        if (!step.fanProfile) break;
        try { await setFanProfile(step.fanProfile); }
        catch (e: any) { const msg = `Fan profile switch failed: ${e.message}`; log.warn(msg); warnings.push(msg); }
        break;
    }
  }
  return warnings;
}
