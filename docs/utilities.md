# Utilities Registry

Every module in `src/utils/`, grouped by what it's for. Purpose: find out whether a helper already exists before writing a new one. This is the `src/utils/` equivalent of the "Shared UI Components" table in [CLAUDE.md](../CLAUDE.md).

Two access patterns exist for reading app config: most modules call `getAppConfig()` from `app-config.ts` directly; `rtss.ts` and `proces-lasso/process-lasso-config.ts` instead go through `src/config.ts`'s `CONFIG` object (a thin wrapper around the same `getAppConfig()`). Prefer `getAppConfig()` directly for anything new — `CONFIG` is legacy from before the util existed.

## Config / storage

| Module | Purpose | Key exports |
|---|---|---|
| `app-config.ts` | Reads/writes `%LOCALAPPDATA%\HandyMon\config.json` with defaulting, Zod validation, in-process cache | `getAppConfig()`, `writeAppConfig(config)`, `invalidateAppConfigCache()` |
| `dirs.ts` | Central source of truth for every on-disk location HandyMon uses — `%LOCALAPPDATA%\HandyMon` (Windows convention: machine-specific data, not a roaming `%APPDATA%` profile), plus its `temp/`/`captures/`/`logs/`/`presentmon/` subfolders. Also resolves where compiled native-interop assemblies live — always precompiled ahead of time by `scripts/compile-native.js`, never at runtime: `<repo-root>/native` for dev and git-checkout production (via `HANDYMON_INSTALL_DIR`, set by `tray-main.js`/`server.js`), the install directory for a packaged build — see [startup.md](startup.md#native-interop-compilation). | `CONFIG_DIR`, `TEMP_DIR`, `CAPTURES_DIR`, `LOG_DIR`, `PRESENTMON_DIR`, `NATIVE_DIR` |
| `id.ts` | Slug helper | `toKebabId(name)` |
| `theme-storage.ts` | Selected-theme-id persistence (localStorage, per-device) + CSS var derivation for any `ThemePreset` — custom theme *definitions* live in config.json instead (see data-models.md#theming) | `loadActiveThemeId()`/`saveActiveThemeId()`, `getAllThemes()`, `resolveTheme()`, `themeToCssVars()`, `applyThemeVars()` |
| `logger.ts` | File-backed logger under `%LOCALAPPDATA%\HandyMon\logs\`, backing `GET /api/logs` | `log.error()`/`log.warn()`/`log.info()`/`log.debug()`, `readLogTail()` |
| `onboarding.ts` | Reads/writes `%LOCALAPPDATA%\HandyMon\onboarding.json` — flat `tipId -> acknowledged version` map backing the Onboarding Tips system (see CLAUDE.md), host-only so no per-device dimension | `getDismissed()`, `dismissTips(versions)` |

## Windows process / window control

| Module | Purpose | Key exports |
|---|---|---|
| `windows.ts` | Foundational PowerShell execution + window-focus P/Invoke script builders | `runPsScript()`, `runPsScriptJson<T>()`, `encodePsScript()`, `buildFocusByPidScript()`, `buildScanAndFocusScript()`, `buildDelayedFocusScript()` |
| `native-worker.ts` | Persistent compiled-C# native-interop worker — one process, spawned lazily and kept alive for the app's lifetime, queried over stdin/stdout with tagged JSON-line requests. For anything *polled* (active window, window list, per-process CPU/RAM) instead of invoked occasionally — those used to spawn a fresh PowerShell on every poll tick; this pays the spawn cost once. Communicates over anonymous pipes (not a named pipe/socket), so nothing outside the Node process that spawned it can reach it. The exe it spawns (`native-src/native-worker.cs`) is always precompiled ahead of time by `scripts/compile-native.js` — never at runtime. | `queryNativeWorker<T>(cmd, timeoutMs?)` — commands: `foreground` (active window PID), `windows` (visible-window list), `processUsage` (per-PID CPU%/RAM via WMI) |
| `command.ts` | Minimal generic shell command runner | `execCommand(command)` |
| `processes.ts` | Process enumeration/inspection (native worker for the polled path, WMI/PowerShell for one-off lookups) | `getProcessUsage()` (fast, native-worker-backed, prefer this for polling), `getProcessDetail(pid)`, `listRunningProcesses()` (slower two-sample CPU delta), `listRunningProcessNames()` |
| `virtual-keyboard.ts` | Text injection into the focused window via clipboard+paste | `typeText(text)` |
| `actions.ts` | Executes user-defined Actions (steps: launch/hotkey/keysequence/delay/text/macro/display/audio/fan) | `executeAction(action, allActions, depth?)` — recurses for `macro` steps, returns a `warnings` array (see [features.md](features.md#actions) for which step types are fault-tolerant); `executeLaunchAction()`, `executeHotkeyAction()` (single-step helpers, also called directly by `/api/keyboard/*`), `executeKeySequenceAction()` — see [features.md](features.md#actions) for how `hotkey` and `keysequence` differ |

`runPsScript()`/`encodePsScript()` from `windows.ts` are the required path for any new PowerShell execution — see the standing rule in [CLAUDE.md](../CLAUDE.md). For anything *polled* rather than invoked occasionally, prefer routing through `native-worker.ts` instead (add a new command to its `native-src/native-worker.cs` switch, then run `npm run compile-native`) — one persistent process beats a fresh PowerShell spawn per tick.

## Device / service control

| Module | Purpose | Key exports |
|---|---|---|
| `service.ts` | Generic start/stop/restart controller factory (Windows Service or Scheduled Task), with real status polling | `makeService()`, `makeServiceFromName()`, `isServiceRunning()`, `waitForServiceStatus()`, `ServiceController` (type) |
| `services.ts` | Accessor layer over user-configured Services (from app config) | `listServiceConfigs()`, `getServiceConfig(id)`, `controllerFor(cfg)` |
| `service-controller-route.ts` | Turns a `ServiceController` into a pair of Next.js route handlers | `makeServiceControllerRoutes(controller, opts?)` |
| `display-profiles.ts` | Capture/list/apply/rename/reorder/delete saved monitor layouts, stored in `AppConfig.displayProfiles`; active-profile detection | `listDisplayProfiles()`, `captureDisplayProfile(label)`, `updateDisplayProfile(id)`, `renameDisplayProfile(id, label)`, `reorderDisplayProfiles(orderedIds)`, `deleteDisplayProfile(id)`, `getActiveDisplayProfileId()`, `setDisplayProfile(id, allowChanges?)` |
| `native-display.ts` | Native CCD API interop (Windows' own `QueryDisplayConfig`/`SetDisplayConfig`) backing `display-profiles.ts` — replaces MonitorSwitcher.exe | `captureDisplayConfig()`, `applyDisplayConfig()`, `validateDisplayConfig()`, `fingerprintDisplayConfig()`, `getDisplayDetails()` |
| `audio-devices.ts` | Lists/switches audio devices via native Core Audio interop | `listAudioDevices()`, `setDefaultAudioDevice()`, `setVolume()` |
| `native-audio.ts` | Native Core Audio COM interop (`IMMDeviceEnumerator`/`IAudioEndpointVolume`/`IPolicyConfig`) backing `audio-devices.ts` — replaces SoundVolumeView.exe | `listRenderDevices()`, `setNativeVolume()`, `setNativeDefaultEndpoint()` |
| `fan-control.ts` | Reads/applies fan profiles via FanControl | `getActiveFanProfile()`, `listFanProfiles()`, `setFanProfile()` |
| `rtss.ts` | Reads/writes RTSS per-process `.cfg` profiles | `listRtssProfiles()`, `getActiveRtssProfile()`, `getRtssConfig()`/`setRtssConfig()`/`patchRtssConfig()`, `copyRtssProfile()`, `rtssAvailable()`, `RtssService` |
| `proces-lasso/process-lasso.ts` | Zod schemas + INI (de)serialization for Process Lasso's packed CPU-set string | `parseCpuLimitRules()`, `stringifyCpuLimitRules()`, `processLassoConfigFromString()`, `processLassoConfigToString()` |
| `proces-lasso/process-lasso-config.ts` | Reads/writes Process Lasso's `prolasso.ini`, CPU-set mutation helpers | `getProcessLassoConfig()`, `setProcessLassoConfig()`, `setCpuSet()`, `removeCpuSet()`, `reorderCpuSets()`, `processLassoAvailable()` |
| `proces-lasso/process-rule-presets.ts` | Pure helpers for displaying core sets and inferring preset matches — no longer hardcodes any preset list (see `ProcessRulePreset` in data-models.md for the user-configurable presets) | `formatCoreRanges(cores, separator?)` (collapses core indices into a range string, e.g. `0-3, 5, 7-8`), `describeCoreSet(cores, presets)` (matching saved preset's label, else a range summary), `matchProcessRulePreset(cores, priority, presets)` (best-matching preset for a process rule's current values) |

## Auth / permissions / device pairing

| Module | Purpose | Key exports |
|---|---|---|
| `devices.ts` | Device pairing/registry + HMAC session-token issuance/validation (page-shell auth only, see `request-signing.ts` below for API-call auth) and per-device public-key storage; owns the server secret (its own `%LOCALAPPDATA%\HandyMon\server-secret` file, deliberately separate from `config.json` — see data-models.md) | `initDevices()`, `generateDeviceToken()`, `isValidDeviceToken()`, `getDevices()`, `createDevice()`, `activateDevice()`, `setDevicePublicKey()`, `getDeviceById()`, `updateDevice()`, `deleteDevice()` |
| `request-signing.ts` | Server-side verification of per-request ECDSA-signed API calls (the actual API auth boundary — the session cookie only gates the page shell) | `verifySignedRequest(headers, method, url, publicKeyJwk)` |
| `request-signing-client.ts` | Client-side counterpart — generates the on-device keypair at pairing time and signs each outgoing API request | `generateAndStoreKeyPair(deviceId)`, `signRequest(method, url)` |
| `grants.ts` | Per-device permission checking for API routes; localhost bypass | `hasGrant(deviceId, grant)`, `requireGrant(req, grant)` |
| `request-utils.ts` | Localhost-only request gating (coarser than grants, for host-only actions) | `isLocalhostRequest(req)`, `localhostOnly(req)` |
| `api-client.ts` | Client-side fetch wrapper — throws on non-2xx instead of returning error JSON as data | `ApiError`, `apiFetch<T>(url, init?)` |

`grants.ts` and `request-utils.ts` each have their own private "is this localhost" check (same regex, different `Request` type) — a minor known duplication, not yet consolidated.

## Performance monitoring

| Module | Purpose | Key exports |
|---|---|---|
| `lhm.ts` | Reads CPU/GPU sensor data from LibreHardwareMonitor's web server | `fetchLhmStats()`, `checkLhmAvailable()`, `extractSensorGroups()`, `fetchLhmSensorGroups()`, `probeLhm(port)` |
| `perf.ts` | Native Windows performance counters (CPU/RAM/GPU/disk/network/pagefile/top-processes) | `collectNativeStats()`, `collectRamOnly()` (fast path, prefer for polling), `collectAdvancedStats()`, `collectCaptureIoSample()` (leaner disk/net/RAM-only path for capture-sensors.ts's once-a-second sampler) |
| `presentmon.ts` | Persistent PresentMon (ETW) capture singleton — live FPS/frametime/hitch stats + benchmark capture runs | `ensurePresentMon()`, `getPresentMonFramerate()`, `getPresentMonProcess()`, `probePresentMon()`, `debugPresentMon()` (snapshot of the persistent capture's current state), `diagnosticProbePresentMon()` (deterministic one-shot spawn+probe with the real streaming args — reports header-parsed/exit-code/timeout; backs the Settings "Show diagnostic" panel), `startCaptureRun()`/`stopCaptureRun()`/`clearCaptureRun()`/`captureRunStatus()` |
| `captures.ts` | Persists/summarizes/prunes PresentMon capture-run CSVs; CapFrameX integration | `captureBaseName()`, `summarize()`, `computeWindowedSummary(file, dir, start, end, hitchThreshold)` (recomputes stats from just a [start,end] time slice — the Comparison region selector; shares stat math with `summarize()` via an internal `summarizeFrames()`), `finalizeCapture()`, `listCaptures()`, `readCaptureData()`, `deleteCapture()`, `openWithCapFrameX()` |
| `capture-sensors.ts` | Server-side, once-a-second system-state sampler that runs for the lifetime of a capture run (LHM + disk/network/RAM), independent of the frame CSV — written as `<base>.sensors.jsonl` so the capture viewer can show what CPU/GPU/disk/network were doing at any given hitch | `captureSensorSampler` (singleton — `.start(base)`/`.stop()`, called from presentmon.ts's capture lifecycle), `readCaptureSensors(base)`, `deleteCaptureSensors(base)` |
| `comparisons.ts` | Orchestrates a Comparison (named group of labeled Variants, each a normal Capture written into its own `captures/comparisons/<id>/` subfolder) — start/pause/continue/finish lifecycle, manifest read/write, list/delete, region selector, build-from-existing-captures. Reuses captures.ts/capture-sensors.ts/presentmon.ts unmodified via their `dir`/`onFinalize`/`maxDurationS` params rather than duplicating capture logic | `startComparison()`, `pauseComparison()`, `continueComparison(label?, matchFirstDuration?)` (looks up the first variant's own duration server-side — the client only sends a boolean), `finishComparison()` (async — waits for the in-progress variant's finalize before resolving), `createComparisonFromCaptures(items, label?)` (builds a Comparison from 2+ existing standalone captures — copies their csv/sidecar/sensors.jsonl as-is into a new comparison folder, variant summaries come straight from each capture's already-written sidecar, nothing recomputed), `comparisonStatus()`, `listComparisons()`, `readComparison()`, `setVariantRegion(id, variantBase, start, end)` (persists a region + its recomputed windowed summary), `deleteComparison()` |

## Maintenance

When a util module is added or removed, update this doc (see [docs/maintenance.md](maintenance.md)).
