# Data Models

## Actions

Defined in `src/types/app-config.ts`, stored in `AppConfig.actions`/`actionGroups`/`actionPages` — fully user-configurable (added/edited/deleted via `ActionsSection.tsx`), not hardcoded. New installs start with an empty list. There's no separate Launch/Hotkey/Sequence type — every Action is a step list; a single-step Action is just a 1-step sequence.

```typescript
type Action = {
  id: string;
  name: string;
  steps: SequenceStep[];
  favourite?: boolean;
  groupId?: string;
  pageId?: string;               // only meaningful when ungrouped — a grouped action follows its group's page instead
  icon?: string;                 // emoji string, or a data: URI (uploaded/extracted image)
  requireConfirmation?: boolean; // ask before running, e.g. for a "close program" hotkey
}

type ActionGroup = {
  id: string;
  name: string;
  pageId?: string; // which Page this group appears on — omitted means the default "Home" page
}

// A swipeable top-level partition of the Actions list (like the Perf tab
// strip), sitting one level above Groups — see features.md#actions "Pages".
// The default "Home" page always exists and is never stored here — omitted
// pageId on an Action or ActionGroup both mean "Home".
type ActionPage = {
  id: string;
  name: string;
}

type KeySequenceEvent =
  | { kind: 'down'; key: string }
  | { kind: 'up';   key: string }
  | { kind: 'wait'; ms: number }  // 0-10000

type SequenceStep =
  | { type: 'macro';   macroId: string }                              // run another Action by id
  | { type: 'hotkey';  keys: string[] }                                // all keys pressed together as one atomic combo
  | { type: 'keysequence'; events: KeySequenceEvent[] }                // max 50 — ordered down/up/wait events, e.g. hold Shift across several taps
  | { type: 'launch';  program: string; args?: string[]; autoFocus?: boolean; focusMode?: 'delay' | 'scan'; focusDelay?: number }
  | { type: 'delay';   ms: number }
  | { type: 'text';    text: string }                                 // types into the focused window
  | { type: 'display'; displayProfileId: string }                     // switch monitor layout
  | { type: 'audio';   audioDeviceId: string; audioVolume?: number }   // references ConfiguredAudioDevice.id
  | { type: 'fan';     fanProfile: string }                            // FanControl profile filename (without .json)
```

The `display`/`audio`/`fan` step types fold in what a deleted "Modes" feature used to do as a fixed bundle — see [Actions](features.md#actions) for the fault-tolerance rules specific to these three.

`audioDeviceId` references a `ConfiguredAudioDevice` (below) by id — resolving it to an actual live device at runtime is a name/substring match (see `matchValue` below), not a stored predicate.

---

## Audio Devices

Defined in `src/types/audio-devices.ts`.

```typescript
type AudioDevice = {
  id: string;               // native Core Audio endpoint ID (used for SetDefault/SetVolume)
  name: string;             // display name (e.g. "Speakers (Realtek)")
  deviceName: string;       // hardware device name (e.g. "DENON-AVR")
  isDefaultMultimedia: boolean;
  isActive: boolean;
  volumePercent: number | null;
}

type AudioDeviceResponse = {
  active: AudioDevice | null;
  available: AudioDevice[];
}
```

API action body is validated with Zod — union of `SetVolumeAction` (`{ action: 'setVolume', volume: number }`) and `SetDefaultAction` (`{ action: 'setDefault', type: MediaDefaultType }`).

---

## Display Profiles

Defined as `DisplayProfileConfig` in `src/types/app-config.ts`, stored in `AppConfig.displayProfiles` — captured from the live monitor layout, never hand-authored.

```typescript
type DisplayProfileConfig = {
  id: string;
  label: string;
  json: string;          // opaque blob (native-display.ts's own serialization), applied via SetDisplayConfig
  fingerprint?: string;   // LUID-independent signature, used for active-profile detection; undefined until (re-)captured post-fingerprint
}
```

A `SequenceStep`'s `display` variant holds `displayProfileId`, a reference to `DisplayProfileConfig.id`. See [features.md](features.md#display-profiles).

---

## RTSS Config

Defined in `src/types/rtss.ts`. The full schema is complex — RTSS `.cfg` files are INI with many sections. Key parts:

```typescript
type RtssProfile = {
  name: string;      // profile name (equals process name without .exe, or 'Global')
  fileName: string;  // filename on disk (e.g. 'GameName.cfg', or 'Global' for the global profile)
}
```

`RtssConfigSchema` is a Zod schema covering all INI sections: `Framerate`, `OSD`, `Statistics`, `Hooking`, `Font`, `Renderers`, `Info`. Uses a custom `zBool01` validator for RTSS's convention of using `0`/`1` integers as booleans.

`PartialRtssConfig` is a deep-partial version used for patch operations — merge into existing config with lodash `_.merge`, then re-validate.

---

## Fan Control Cache

`src/types/fan-control.ts` — Zod schema for FanControl's `CACHE` JSON file. The relevant field is `CurrentConfigFileName` (string, the active profile filename).

---

## Process Lasso Config

`src/utils/proces-lasso/process-lasso.ts` — Zod schemas for the INI config.

```typescript
type CpuLimitRule = {
  exe: string;      // process name (e.g. 'chrome.exe')
  cores: number[];  // allowed core indices (e.g. [0,1,2,3])
}

type IoPriorityRule = {
  exe: string;                    // process name
  priority: 0 | 1 | 2 | 3;        // Windows IO_PRIORITY_HINT: 0=Very Low, 1=Low, 2=Normal, 3=High
}
```

The INI stores four independent compact strings under `[ProcessDefaults]`/`[GamingMode]` — CPU sets: `exe,(start-end;core;...),exe,(...),...`; I/O priorities: `exe,priority,exe,priority,...` (a flat list, no parens); CPU priorities (`DefaultPriorities`): `exe,priority-string,exe,priority-string,...` (e.g. `processlasso.exe,above normal`); Induce Performance Mode (`AutomaticGamingModeProcessPaths`, under `[GamingMode]` not `[ProcessDefaults]`): a plain `exe,exe,...` list with no values — membership alone means enabled. The util parses each to its own typed array on read and serialises back on write. Two Zod schemas handle the two directions for all four:
- `ProcessLassoRuntimeConfigSchema` — parses the compact strings into `CpuLimitRule[]` / `IoPriorityRule[]` / `CpuPriorityRule[]` / `string[]`
- `ProcessLassoOutputConfigSchema` — transforms them back to the compact strings for writing

The UI (`ProcessLassoSection.tsx`) merges all four arrays by `exe` into one per-process view for display/editing, but they remain four separate underlying INI keys — a process can have any combination set. GPU priority (`DefaultGPUPriorities`) is intentionally not modeled yet — its value format hasn't been confirmed against a live config (unlike the other three, which were each confirmed via a live prolasso.ini, the Induce Performance Mode mapping specifically via a before/after diff).

### Process Rule Presets

`ProcessRulePreset` in `src/types/app-config.ts`, stored in `AppConfig.processRulePresets` (on-disk field renamed from `cpuSetPresets` — `getAppConfig()` in `src/utils/app-config.ts` still reads the old key as a fallback so existing configs don't lose their presets) — user-named, user-saved core groupings (e.g. "Performance Cores") and/or an I/O priority/CPU priority/Induce Performance Mode opinion, empty by default (there's no way to infer sensible presets for an unknown CPU topology, so the picker UI just starts with a blank per-core checkbox grid sized to `os.cpus().length`).

```typescript
type ProcessRulePreset = {
  id: string;
  label: string;
  cores?: number[];             // logical core indices — omitted means "no cores opinion"
  ioPriority?: 0 | 1 | 2 | 3;    // omitted means "no I/O priority opinion"
  cpuPriority?: 'idle' | 'below normal' | 'normal' | 'above normal' | 'high' | 'realtime'; // omitted means "no CPU priority opinion"
  performanceMode?: boolean;    // omitted means "no Induce Performance Mode opinion"
}
```

All four fields are independently optional — a preset can define any combination. Applying a preset only touches the fields it actually defines, leaving whatever's already selected for the other fields alone (e.g. a CPU-priority-only preset never clears an already-picked core set).

Rendered/edited via `ProcessRulePicker` + `ManagePresetsDialog` (`src/components/ui/ProcessRulePicker.tsx`), shared by the Process Lasso settings dialog and the Processes tab's CPU-set-assign control (the latter stays cores-only — it never wires up the other apply callbacks). Presets support full edit-in-place (not just delete+recreate) via `useSaveProcessRulePreset`'s optional `editId` param; `ManagePresetsDialog` shows only the add/edit form (not the rest of the preset list) once you've picked a preset to edit.

**Preset ↔ process-rule matching is inferred by value, not stored as an explicit link** — `matchProcessRulePreset()` (`src/utils/proces-lasso/process-rule-presets.ts`) checks whether a process rule's current cores/priority/cpuPriority/performanceMode exactly match a preset's defined fields. This is what powers `ProcessLassoSection.tsx`'s "select all matching a preset" bulk-select and the per-row preset-match badge — self-healing (no link to go stale), but also means hand-editing a rule's values silently stops it matching, which is the intended behavior.

---

## Server Secret & Device Registry

`src/utils/devices.ts` owns two on-disk files under `%LOCALAPPDATA%\HandyMon\`, both deliberately **separate from `config.json`**:

- **`server-secret`** — a plain-text random hex string (not JSON), used to HMAC-sign device bearer tokens. Used to live inside `config.json` itself; moved out after a real incident where a stray UTF-8 BOM (written by a PowerShell installer script's `-Encoding UTF8`, which always adds one in Windows PowerShell 5.1) made `JSON.parse` throw on every read, which the surrounding `try/catch` silently swallowed — both `getAppConfig()` and `loadOrCreateServerSecret()` treated the file as if it didn't exist yet and each rewrote their own defaults, wiping the other's data and regenerating the secret (invalidating every paired device) on every single app restart. Keeping the secret in its own file means a corrupt/BOM'd `config.json` can no longer take the secret down with it, and vice versa. `loadOrCreateServerSecret()` migrates an old in-`config.json` secret on first read rather than generating a fresh one, so existing paired devices survive the migration.
- **`devices.json`** — `DeviceRegistration[]` (id, name, pairedAt, lastSeen, grants, publicKeyJwk), the paired-device list itself.

Both `app-config.ts`'s `getAppConfig()`/`writeAppConfig()` and `devices.ts`'s secret reader now also defensively strip a leading BOM before `JSON.parse`, in case one gets reintroduced (e.g. by hand-editing a file in Notepad, which also defaults to BOM'd UTF-8 saves).

---

## Theming

`src/types/theme.ts` defines the color surface every theme fills in:

```typescript
type ThemeColors = {
  bgBase: string; bgRaised: string; bgElevated: string;
  border: string; borderHover: string;
  accent: string;
  success: string; error: string; warning: string;
  textPrimary: string; textSecondary: string; textDim: string;
}

type ThemePreset = { id: string; name: string; colors: ThemeColors }
```

`success`/`error`/`warning` are fixed across the 7 built-in `PREDEFINED_THEMES` (Midnight, Ember, Verdant, Amethyst, Rose — dark; Daylight, Linen — light) since they carry semantic meaning — only bg/border/accent/text vary between them (light themes use a separate `SEMANTIC_LIGHT` triple, tuned to stay legible on a light background rather than washing out). A custom theme (built via Settings → Appearance) is free to override any of the 12 fields.

**Split storage, matching the config-shared-vs-device-local pattern used elsewhere**: the *selected* theme id is a per-device display preference (same category as `perf-pinned-cards`, see `cards/registry.tsx`) and stays in `localStorage` (`src/utils/theme-storage.ts`'s `handymon-active-theme` key, via `loadActiveThemeId()`/`saveActiveThemeId()`). Custom theme *definitions* are shared config — every paired device should see the same palette list — so they live in `AppConfig.customThemes` (`config.json`, mirroring `processRulePresets`) rather than localStorage. Creating/editing/deleting a custom theme requires the `appearance:write` grant (see `src/types/grants.ts`); selecting any existing theme (predefined or custom) is unrestricted.

**Applying a theme** happens in two places that must stay in sync:
1. `AppThemeProvider` (`src/components/ThemeContext.tsx`) computes a MUI theme via `createAppTheme(colors)` (`src/app/theme.ts`) — this drives MUI's own component styling (Dialog, Switch, Slider, ...), which doesn't read the raw CSS vars. `customThemes` is sourced from `useAppConfig()` and written via `useUpdateAppConfig()` (spreading the full config, same pattern as `useSaveProcessRulePreset`).
2. The same effect calls `applyThemeVars(colors)`, which sets `--bg-base`/`--accent`/etc. as inline styles on `document.documentElement` — this is what the rest of the app's `sx={{ color: 'var(--text-primary)' }}`-style styling actually reads. "Dim"/"glow" alpha variants (`--accent-dim`, `--accent-glow`, `--error-dim`) and the nav bar background (`--nav-bg`, `bgBase` mixed 25% toward black — works for both dark and light themes) are derived from their base color at apply-time (`hexToRgba()`/`darken()`) rather than stored per-theme, so a custom theme can't end up with a mismatched derived variant.

**Anti-flash-of-default-theme**: since the *selected* theme id only exists in `localStorage`, a plain SSR render always starts from the built-in default (`DEFAULT_THEME_ID` — Midnight). `src/app/layout.tsx` inlines a small blocking `<script>` in `<head>` that reads that key, matches it against `PREDEFINED_THEMES` only (it can't reach server-side `customThemes` synchronously), and applies the CSS vars *before first paint* — so there's no visible flash for the CSS-var-driven majority of the UI. The theme *data* (`PREDEFINED_THEMES`) is serialized server-side into that script via `JSON.stringify()` rather than duplicated as a literal, so there's one source of truth. If the stored active id happens to be a custom theme, the script falls back to the default until `AppThemeProvider`'s effect applies the real colors post-hydration (a brief flash of the default in that one case). MUI's own component styling (a comparatively small part of the UI) can still flash once on load, since it depends on React hydrating `AppThemeProvider` — an accepted tradeoff of not using a cookie+SSR-theme scheme for what's meant to be a lightweight preference.

---

## Running Process

`src/types/processes.ts`:

```typescript
type RunningProcess = {
  name: string;          // process name without .exe
  exeName: string;       // process name with .exe
  pid: number;
  cpu: number;           // CPU % over a 1-second sample window
  startTime: number | null;  // Unix ms timestamp
}
```
