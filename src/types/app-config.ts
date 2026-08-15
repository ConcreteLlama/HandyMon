import { z } from 'zod';

export const ConfiguredAudioDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  matchValue: z.string(), // matched (case-insensitive) against device.name or device.deviceName
});
export type ConfiguredAudioDevice = z.infer<typeof ConfiguredAudioDeviceSchema>;

export const ActionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Which Page this group appears on — omitted means the default "Home"
  // page (a synthetic page that always exists and isn't itself stored; see
  // ActionPageSchema below). Set once at group-creation time from whichever
  // page was active; there's no UI to move a group to a different page
  // after creation yet.
  pageId: z.string().optional(),
});
export type ActionGroup = z.infer<typeof ActionGroupSchema>;

// A "Page" is a swipeable top-level partition of the Actions list (like the
// Perf section's tab strip) — sits one level above Groups, so a big Actions
// list can be split across e.g. "Home" / "Work" / "Gaming" instead of one
// long scroll. The default "Home" page always exists and is never stored
// here (mirrors how "ungrouped" actions need no explicit ActionGroup entry)
// — omitted groupId/pageId on an Action or ActionGroup both mean "Home".
export const ActionPageSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type ActionPage = z.infer<typeof ActionPageSchema>;

const actionBase = {
  favourite: z.boolean().optional(),
  groupId: z.string().optional(),
  // Only meaningful for an ungrouped action (no groupId) — a grouped action
  // always lives on its group's page (see ActionGroupSchema.pageId).
  pageId: z.string().optional(),
  icon: z.string().optional(),               // emoji string or data: URI
  requireConfirmation: z.boolean().optional(),
};

// 'display'/'audio'/'fan' cover what "Modes" used to do as a fixed bundle —
// folded in as composable sequence steps instead, so a Sequence Action can
// mix them with launch/hotkey/delay/text/nested-action steps freely (e.g.
// set display, set audio, set fan, delay 10s, launch a game, all as one
// action). No embedded delay on the audio step (unlike the old Mode's
// audioDelay field) — compose a standalone 'delay' step before it instead,
// which works before any step, not just audio.
// A Key Sequence step is an ORDERED list of individual key-down/key-up/wait
// events — unlike a 'hotkey' step (all keys pressed together as one atomic
// combo), this lets a modifier stay held across other key presses with real
// timing between them (e.g. hold Shift, tap Left three times, release
// Shift). Built manually (pick key + down/up/wait per event) rather than
// "recorded" — recording isn't viable here: this app is phone-first (no
// physical modifier keys to record from), and even from the host PC's own
// browser, OS-global combos (Alt+Tab, Win+*, media keys) get intercepted
// before they'd ever reach the page.
export const KeySequenceEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('down'), key: z.string() }),
  z.object({ kind: z.literal('up'),   key: z.string() }),
  z.object({ kind: z.literal('wait'), ms: z.number().int().min(0).max(10000) }),
]);
export type KeySequenceEvent = z.infer<typeof KeySequenceEventSchema>;

export const SequenceStepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('macro'),   macroId: z.string() }),
  z.object({ type: z.literal('hotkey'),  keys: z.array(z.string()) }),
  z.object({ type: z.literal('keysequence'), events: z.array(KeySequenceEventSchema).max(50) }),
  z.object({ type: z.literal('launch'),  program: z.string(), args: z.array(z.string()).optional(), autoFocus: z.boolean().optional(), focusMode: z.enum(['delay', 'scan']).optional(), focusDelay: z.number().optional() }),
  z.object({ type: z.literal('delay'),   ms: z.number() }),
  z.object({ type: z.literal('text'),    text: z.string() }),
  z.object({ type: z.literal('display'), displayProfileId: z.string() }),
  z.object({ type: z.literal('audio'),   audioDeviceId: z.string(), audioVolume: z.number().optional() }),
  z.object({ type: z.literal('fan'),     fanProfile: z.string() }),
]);
export type SequenceStep = z.infer<typeof SequenceStepSchema>;

// Every Action is a sequence of steps — a "Launch" action is just a 1-step
// sequence with a launch step, etc. There's no separate Launch/Hotkey/
// Sequence type anymore (there used to be, but a Sequence is a strict
// superset of what either did, so keeping them distinct only added a
// redundant type-selector with no real capability behind it).
export const ActionSchema = z.object({
  id: z.string(), name: z.string(),
  steps: z.array(SequenceStepSchema),
  ...actionBase,
});
export type Action = z.infer<typeof ActionSchema>;

// A host-admin-configured monitorable/controllable Windows service or scheduled
// task. allowControl is a per-service flag (set here, by the admin) — a device
// also needs the services:control grant for start/stop to actually be allowed;
// both gates must pass.
export const ServiceConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  // Windows service name (net start/stop) or scheduled task name — built into a
  // quoted shell command (service.ts), so reject characters that could break out
  // of that quoting even though this is only settable from localhost.
  serviceName: z.string().refine(s => !/["&|<>^`\r\n]/.test(s), {
    message: 'Service name contains unsafe characters',
  }),
  type: z.enum(['service', 'task']).default('service'),
  allowControl: z.boolean().default(false),
});
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

// cores/ioPriority/cpuPriority/performanceMode are all optional — a preset
// can define any combination. Matches Windows' IO_PRIORITY_HINT levels and
// Process Lasso's own CPU priority classes (see
// src/utils/proces-lasso/process-lasso.ts's IO_PRIORITY_LEVELS/
// CPU_PRIORITY_LEVELS — duplicated as literal unions here rather than
// imported, since this is a types-only file and those live in utils/).
export const ProcessRulePresetSchema = z.object({
  id: z.string(),
  label: z.string(),
  cores: z.array(z.number().int().min(0)).optional(),
  ioPriority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  cpuPriority: z.enum(['idle', 'below normal', 'normal', 'above normal', 'high', 'realtime']).optional(),
  performanceMode: z.boolean().optional(),
});
export type ProcessRulePreset = z.infer<typeof ProcessRulePresetSchema>;

// A saved monitor layout — captured via native-display.ts's Capture(), never
// hand-authored (same capture-then-reapply workflow MonitorSwitcher itself
// uses). `json` is an opaque blob only meaningful to native-display.ts.
export const DisplayProfileConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  json: z.string(),
  // LUID-independent signature (native-display.ts's Fingerprint()), used to
  // detect whether this profile matches the live setup. Optional since
  // profiles saved before this field existed won't have one until re-captured.
  fingerprint: z.string().optional(),
});
export type DisplayProfileConfig = z.infer<typeof DisplayProfileConfigSchema>;

// Mirrors ThemeColors (src/types/theme.ts) field-for-field — kept as a
// separate Zod schema here (rather than importing that plain-TS type) since
// this file is the canonical persisted-shape source, same pattern as
// ProcessRulePresetSchema above. Custom themes live in config.json (shared
// across every paired device) — see [[theme storage]] — unlike the *selected*
// theme, which is a per-device localStorage-only preference.
export const CustomThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  colors: z.object({
    bgBase: z.string(), bgRaised: z.string(), bgElevated: z.string(),
    border: z.string(), borderHover: z.string(),
    accent: z.string(),
    success: z.string(), error: z.string(), warning: z.string(),
    textPrimary: z.string(), textSecondary: z.string(), textDim: z.string(),
  }),
});
export type CustomTheme = z.infer<typeof CustomThemeSchema>;

export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
export const LogLevelSchema = z.enum(LOG_LEVELS);
export type LogLevelSetting = z.infer<typeof LogLevelSchema>;

export const AppConfigSchema = z.object({
  logLevel: LogLevelSchema.default('info'),
  // The HTTP port tray-main.js/server.js listen on. Read directly from
  // config.json by those plain-JS entry points too (they can't import this
  // TS module) — see loadPortFromConfig() in tray-main.js. Changing it needs
  // an app restart; there's no live-reload of the listening port.
  port: z.number().int().min(1).max(65535),
  rtssInstallPath: z.string(),
  fanControlPath: z.string(),
  processLassoConfigPath: z.string(),
  lhmPort: z.number().int().min(1).max(65535),
  presentMonPath: z.string(), // path to a PresentMon exe; '' = auto-discover
  // Written directly by the installer's optional-component sections (see
  // scripts/package-win.js) when selected — a deterministic record of what
  // this specific install has, rather than inferring it from other state
  // (a port number matching, a file happening to exist, a process happening
  // to be running) each of which has edge cases the flag itself doesn't.
  // Read back by the installer on reinstall/upgrade to default the
  // Components page checkboxes to what was actually selected last time.
  bundledLhm: z.boolean(),
  bundledPresentMon: z.boolean(),
  fpsPollMs: z.number().int().min(100).max(5000),   // Frame page FPS poll interval
  fpsWindowMs: z.number().int().min(200).max(10000), // instantaneous-FPS smoothing window
  fpsGraphSeconds: z.number().int().min(5).max(120), // FPS/frametime chart time window
  hitchThreshold: z.number().min(1.2).max(5),        // hitch = frametime > N× local avg
  // Process-name patterns the FPS auto-detect heuristic (and the picker's
  // greyed-out/bottom-sorted ranking) never tracks — regex source strings,
  // case-insensitive, matched against the lowercased exe name. Seeded with
  // Windows shell/UI-host noise (dwm.exe, explorer.exe, etc.) on first run;
  // fully user-editable from there via the FPS toolbar's Manage Exclusions
  // dialog. A quick-exclude on a specific process adds an escaped (exact)
  // pattern; hand-edited entries can be broader.
  processExclusions: z.array(z.string()).optional(),
  configuredAudioDevices: z.array(ConfiguredAudioDeviceSchema),
  actionGroups: z.array(ActionGroupSchema),
  actionPages: z.array(ActionPageSchema),
  actions: z.array(ActionSchema),
  services: z.array(ServiceConfigSchema),
  processRulePresets: z.array(ProcessRulePresetSchema),
  customThemes: z.array(CustomThemeSchema),
  displayProfiles: z.array(DisplayProfileConfigSchema),
  // User-customized top-level nav order (section ids, e.g. 'perf', 'actions').
  // Undefined/empty = use the built-in default order. Ids no longer
  // recognized are ignored, and new ids not yet in a saved order are
  // appended at the end — see orderNavItems() in components/nav-items.ts.
  navOrder: z.array(z.string()).optional(),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;
