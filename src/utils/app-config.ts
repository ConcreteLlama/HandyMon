import fs from 'fs';
import path from 'path';
import { AppConfig, AppConfigSchema, ConfiguredAudioDevice, ProcessRulePreset, CustomTheme, DisplayProfileConfig, LOG_LEVELS, LogLevelSetting, Action, ActionGroup, ActionPage, ServiceConfig } from '@/types/app-config';
import { CONFIG_DIR } from './dirs';

const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function defaultConfiguredAudioDevices(): ConfiguredAudioDevice[] { return []; }

// The FPS auto-detect heuristic's original hardcoded exclude list — now the
// seeded default for the user-editable processExclusions config field (see
// presentmon.ts's isProcessExcluded()). Escaped so each entry matches its
// exe name exactly by default; ".exe"'s dot would otherwise be a regex
// metacharacter (matches any single character), silently over-matching.
function defaultProcessExclusions(): string[] {
  const names = [
    'dwm.exe', 'explorer.exe', 'searchhost.exe', 'searchapp.exe',
    'shellexperiencehost.exe', 'startmenuexperiencehost.exe', 'textinputhost.exe',
    'applicationframehost.exe', 'sihost.exe', 'lockapp.exe', 'widgets.exe',
  ];
  return names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

function defaultActions(): Action[] { return []; }
function defaultActionGroups(): ActionGroup[] { return []; }
function defaultActionPages(): ActionPage[] { return []; }
function defaultServices(): ServiceConfig[] { return []; }
function defaultProcessRulePresets(): ProcessRulePreset[] { return []; }
function defaultCustomThemes(): CustomTheme[] { return []; }
function defaultDisplayProfiles(): DisplayProfileConfig[] { return []; }

// Actions used to be a Launch/Hotkey/Sequence discriminated union; now every
// Action is just a sequence of steps (a "Launch" was always just a 1-step
// sequence in disguise). Converts an on-disk action of either shape into
// today's flat `{ id, name, steps, ... }` shape — a no-op (returns `a`
// unchanged) once already migrated, since migrated actions have no `type`.
function migrateActionToSequenceOnly(a: any): any {
  if (!a || typeof a !== 'object') return a;
  if (a.type === 'launch') {
    const { type, program, args, autoFocus, focusMode, focusDelay, ...rest } = a;
    return { ...rest, steps: [{ type: 'launch', program, args, autoFocus, focusMode, focusDelay }] };
  }
  if (a.type === 'hotkey') {
    const { type, keys, ...rest } = a;
    return { ...rest, steps: [{ type: 'hotkey', keys }] };
  }
  if (a.type === 'sequence') {
    const { type, ...rest } = a;
    return rest;
  }
  return a;
}

function buildDefaults(): AppConfig {
  return {
    logLevel: 'info',
    port: 44558,
    rtssInstallPath: 'C:\\Program Files (x86)\\RivaTuner Statistics Server',
    fanControlPath: 'C:\\Program Files (x86)\\FanControl',
    processLassoConfigPath: 'C:\\ProgramData\\ProcessLasso',
    lhmPort: 8085,
    presentMonPath: '',
    bundledLhm: false,
    bundledPresentMon: false,
    fpsPollMs: 400,
    fpsWindowMs: 1000,
    fpsGraphSeconds: 30,
    hitchThreshold: 2,
    processExclusions: defaultProcessExclusions(),
    configuredAudioDevices: defaultConfiguredAudioDevices(),
    actionGroups: defaultActionGroups(),
    actionPages: defaultActionPages(),
    actions: defaultActions(),
    services: defaultServices(),
    processRulePresets: defaultProcessRulePresets(),
    customThemes: defaultCustomThemes(),
    displayProfiles: defaultDisplayProfiles(),
  };
}

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  let raw: Record<string, unknown> = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      // Strip a leading UTF-8 BOM (e.g. from PowerShell's `-Encoding UTF8`,
      // or Notepad's default UTF-8 save) — JSON.parse throws on it otherwise,
      // which used to be silently caught here and treated as "no config
      // exists yet", wiping every setting back to defaults on next write.
      let text = fs.readFileSync(CONFIG_FILE, 'utf-8');
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      raw = JSON.parse(text);
    }
  } catch {}

  const defaults = buildDefaults();
  const merged = {
    logLevel:                   LOG_LEVELS.includes(raw.logLevel as LogLevelSetting) ? raw.logLevel as LogLevelSetting : defaults.logLevel,
    port:                       typeof raw.port === 'number' && raw.port >= 1 && raw.port <= 65535 ? raw.port : defaults.port,
    rtssInstallPath:            typeof raw.rtssInstallPath === 'string'            ? raw.rtssInstallPath            : defaults.rtssInstallPath,
    fanControlPath:             typeof raw.fanControlPath === 'string'             ? raw.fanControlPath             : defaults.fanControlPath,
    processLassoConfigPath:     typeof raw.processLassoConfigPath === 'string'     ? raw.processLassoConfigPath     : defaults.processLassoConfigPath,
    lhmPort:                    typeof raw.lhmPort === 'number' && raw.lhmPort >= 1 && raw.lhmPort <= 65535 ? raw.lhmPort : defaults.lhmPort,
    presentMonPath:             typeof raw.presentMonPath === 'string' ? raw.presentMonPath : defaults.presentMonPath,
    bundledLhm:                 typeof raw.bundledLhm === 'boolean' ? raw.bundledLhm : defaults.bundledLhm,
    bundledPresentMon:          typeof raw.bundledPresentMon === 'boolean' ? raw.bundledPresentMon : defaults.bundledPresentMon,
    fpsPollMs:                  typeof raw.fpsPollMs === 'number' && raw.fpsPollMs >= 100 && raw.fpsPollMs <= 5000 ? raw.fpsPollMs : defaults.fpsPollMs,
    fpsWindowMs:                typeof raw.fpsWindowMs === 'number' && raw.fpsWindowMs >= 200 && raw.fpsWindowMs <= 10000 ? raw.fpsWindowMs : defaults.fpsWindowMs,
    fpsGraphSeconds:            typeof raw.fpsGraphSeconds === 'number' && raw.fpsGraphSeconds >= 5 && raw.fpsGraphSeconds <= 120 ? raw.fpsGraphSeconds : defaults.fpsGraphSeconds,
    hitchThreshold:             typeof raw.hitchThreshold === 'number' && raw.hitchThreshold >= 1.2 && raw.hitchThreshold <= 5 ? raw.hitchThreshold : defaults.hitchThreshold,
    processExclusions: Array.isArray(raw.processExclusions) ? raw.processExclusions : defaults.processExclusions,
    configuredAudioDevices: Array.isArray(raw.configuredAudioDevices) && (raw.configuredAudioDevices as any[]).length > 0
      ? raw.configuredAudioDevices : defaults.configuredAudioDevices,
    // Fall back to the pre-rename field names (macros/macroGroups) so existing
    // on-disk configs keep their actions across the Macro->Action rename.
    actionGroups: Array.isArray(raw.actionGroups) ? raw.actionGroups : Array.isArray(raw.macroGroups) ? raw.macroGroups : defaults.actionGroups,
    actionPages: Array.isArray(raw.actionPages) ? raw.actionPages : defaults.actionPages,
    actions: (Array.isArray(raw.actions) ? raw.actions : Array.isArray(raw.macros) ? raw.macros : defaults.actions)
      .map(migrateActionToSequenceOnly),
    services: Array.isArray(raw.services) ? raw.services : defaults.services,
    // Fall back to the pre-rename field name (cpuSetPresets) so existing
    // on-disk configs keep their presets across the CpuSetPreset->ProcessRulePreset rename.
    processRulePresets: Array.isArray(raw.processRulePresets) ? raw.processRulePresets
      : Array.isArray(raw.cpuSetPresets) ? raw.cpuSetPresets : defaults.processRulePresets,
    customThemes: Array.isArray(raw.customThemes) ? raw.customThemes : defaults.customThemes,
    displayProfiles: Array.isArray(raw.displayProfiles) ? raw.displayProfiles : defaults.displayProfiles,
    navOrder: Array.isArray(raw.navOrder) ? raw.navOrder as string[] : undefined,
  };

  cachedConfig = AppConfigSchema.parse(merged);
  return cachedConfig;
}

export function writeAppConfig(config: AppConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      let text = fs.readFileSync(CONFIG_FILE, 'utf-8');
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      existing = JSON.parse(text);
    }
  } catch {}
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ ...existing, ...config }, null, 2));
  fs.renameSync(tmp, CONFIG_FILE);
  // Invalidate rather than `cachedConfig = config` — `config` here is
  // whatever the caller passed, which isn't necessarily the full merged
  // object that was just written (e.g. sanitizeForRemote() in
  // api/config/route.ts returns a whitelisted subset of fields; a field
  // missing from that whitelist was never actually lost from the FILE
  // — the {...existing, ...config} merge above already protects that —
  // but a direct `cachedConfig = config` would silently drop it from the
  // in-memory view for every reader until the next restart, even though
  // disk stayed correct the whole time. Clearing the cache forces the next
  // getAppConfig() to re-read+re-validate the file that was just written,
  // so the cache can never diverge from disk regardless of what any
  // caller — present or future — passes in here.
  cachedConfig = null;
}

export function invalidateAppConfigCache(): void {
  cachedConfig = null;
}
