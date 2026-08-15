# Feature Inventory

## Authentication & Device Pairing

Two layers, not one shared secret: a per-device session cookie gates whether the SPA page shell loads at all, but actual API calls are gated by **per-request ECDSA signing**, not the cookie — a static token sent on every request forever is exactly what made a single sniffed request a standing credential under the old design. Each paired device gets its own keypair and its own set of permission grants (see [Permission Grants](../CLAUDE.md#permission-grants) in CLAUDE.md). The host device (accessing via `localhost`/`127.0.0.1`) is always fully trusted, no pairing needed.

| Layer | File |
|-------|------|
| Device registry / session tokens | `src/utils/devices.ts` — server secret (`initDevices()`, called at startup), `generateDeviceToken()`/`isValidDeviceToken()` (format: `<deviceId>.<HMAC-SHA256(deviceId, secret)>`), `createDevice()`, `activateDevice()`, `setDevicePublicKey()`, `getDevices()`/`updateDevice()`/`deleteDevice()` |
| Per-request signing | `src/utils/request-signing.ts` (server-side `verifySignedRequest()`) / `src/utils/request-signing-client.ts` (client-side keypair generation + request signing) — an ECDSA P-256 keypair generated on-device at pairing time; only the public half (`publicKeyJwk`) ever reaches the server |
| Grants | `src/utils/grants.ts` — `requireGrant(req, grant)`, the per-route guard; localhost bypasses all grant checks |
| Startup hook | `src/instrumentation.ts` — calls `initDevices()` at server start (Node.js runtime) |
| Middleware | `src/middleware.ts` — page routes: validates the `pc-control-auth` cookie or `Authorization: Bearer` header (gates the page shell only); API routes: validates the `x-device-id`/`x-signature-*` headers against the device's stored public key instead |
| Pair API | `POST /api/auth/pair-info` — registers a new device (name + optional grants), returns a QR code encoding a one-time pairing link |
| Complete-pairing API | `POST /api/auth/complete-pairing` — the pairing link's client page generates a keypair and posts its public key + the one-time token here; validates the token, activates the device, stores the public key, sets the session cookie |
| Login page | `src/app/login/page.tsx` + `src/components/LoginScreen.tsx` |
| Pair page | `src/app/pair/page.tsx` + `src/components/PairSection.tsx` — standalone QR page at `/pair`, localhost-only |
| Pair-complete page | `src/app/pair-complete/page.tsx` — what the QR code links to; open pre-auth by design (a device isn't paired yet when it lands here), gated by the one-time token instead |
| Introspection | `GET /api/auth/my-connection`, `GET /api/auth/my-grants` — a device querying its own identity/grants (not a security boundary), surfaced in Settings → My Connection (`src/components/settings/MyConnectionSection.tsx`) |

Session tokens have no expiry — valid until the device is explicitly removed in Settings → Devices. The session cookie is `HttpOnly`, `SameSite=Lax`, 1-year `maxAge`.

**Pair flow:** open `http://localhost:44558/pair` on the PC (or use the tray icon's "Pair new device"), scan the QR with the phone — it opens `/pair-complete?token=...`, which generates an ECDSA keypair on-device (private key never leaves it), posts the public key to `complete-pairing`, and gets the session cookie back. The device is now registered with whatever grants were set at pairing time (editable later in Settings). Every subsequent API call from that device is signed with its private key rather than replaying the cookie. Attempting to access `/pair` or `/api/auth/pair-info` from the LAN (non-localhost) is blocked by middleware.

"Localhost" detection trusts the `Host` header (see `src/utils/request-utils.ts`) — this is only safe because `server-guard.js` rejects a spoofed `Host: localhost` before the request reaches this check; see the comment there for the full reasoning.

---

## Actions

The primary feature. An Action is a named, user-configurable sequence of steps, triggered in one tap. There's no separate "Launch"/"Hotkey" action type — every Action is a step list; a single-step Action is just a 1-step sequence (this used to be a real type split, collapsed because Sequence was always a strict superset).

| Layer | File |
|-------|------|
| Type / data | `Action`, `SequenceStep`, `ActionGroup`, `ActionPage` in `src/types/app-config.ts`; stored in `AppConfig.actions`/`actionGroups`/`actionPages` |
| Execution engine | `src/utils/actions.ts` → `executeAction(action, allActions, depth?)`, recursing into nested Actions via a `macro` step (depth-limited to 10) |
| API — execute | `POST /api/actions/[id]/execute` → returns `{ ok: true, warnings: string[] }` |
| API — icon extraction | `POST /api/actions/extract-icon` (from an exe path), `GET /api/actions/validate-delete` (blocks deleting an Action still referenced by a `macro` step elsewhere) |
| API — add/edit/delete | `GET/POST /api/config` (actions are part of the general app config payload) |
| Component | `src/components/ActionsSection.tsx` (list/run/edit/reorder — groups, favourites, and per-group items are all drag-reorderable via `@dnd-kit`) |
| Hook | `src/hooks/actions/useExecuteAction.ts` — surfaces any returned `warnings` as a toast |
| Grants | `actions:read` / `actions:execute` / `actions:edit` |

Step types: `launch`, `hotkey`, `keysequence`, `delay`, `text`, `macro` (run another Action by id), `display`, `audio`, `fan` — the last three fold in what a deleted "Modes" feature used to do as a fixed bundle (display+audio+fan together); now they're just steps, freely composable with everything else (e.g. "gaming mode": set display → set audio → set fan → delay → launch a game, all as one Action).

`hotkey` vs `keysequence`: a `hotkey` step presses all its keys together as one atomic combo (built as a single P/Invoke `keybd_event` script — see `src/utils/actions.ts`'s `executeHotkeyAction()`). A `keysequence` step is an ORDERED list of individual down/up/wait events instead, so a modifier can stay held across other key presses with real timing between them (e.g. hold Shift, tap Left three times, release Shift) — something an atomic combo can't express. It's built manually in the UI (pick a key, then DOWN/UP/WAIT per event) rather than "recorded": recording isn't viable here since HandyMon is phone-first (no physical modifier keys to record from), and even from the host PC's own browser, OS-global combos (Alt+Tab, Win+*, media keys) get intercepted before they'd ever reach the page. Backed by `executeKeySequenceAction()` in `src/utils/actions.ts`.

The three state-switching step types (`display`/`audio`/`fan`) are **fault-tolerant** — a failed step is caught, logged, and pushed onto a `warnings` array rather than aborting the sequence, since a game shouldn't fail to launch just because a display profile went stale. The other step types (`launch`/`hotkey`/`delay`/`text`/`macro`) are **not** — a throw there aborts the rest of the sequence, matching how they behaved before Modes existed. `warnings` (if any) come back from the execute API and surface as a toast client-side, in addition to being logged server-side.

Icons: an Action's icon can be an emoji, a pasted/uploaded image, extracted from an exe path, extracted from an installed Start Menu app (fails for packaged/UWP apps — `src/app/api/programs/list/route.ts` can't always resolve a real exe path for those), or extracted from a **currently-running process** (`src/components/RunningProcessDialog.tsx`, backed by the existing `windows/list` endpoint) — the last option is the reliable fallback for packaged/UWP apps, since a running instance always resolves to a real file path.

Actions are fully user-configurable (added/edited/deleted through the UI), not hardcoded — new installs start with an empty list. See [data-models.md](data-models.md#actions) for the type structure.

**Pages** — an optional swipeable partition ABOVE Groups (like the Perf section's tab strip: `src/components/ui/SwipeableTabs.tsx`), for when one Actions list gets too long. There's always an implicit "Home" page (id `'home'`, never stored — same "no entry needed for the default bucket" pattern as ungrouped actions needing no `ActionGroup`); users can add more via `AppConfig.actionPages`. A `Group` belongs to exactly one page (`ActionGroup.pageId`, set once at group-creation time from whichever page was active — no UI yet to move an existing group to a different page); an ungrouped `Action` carries its own `pageId` directly, editable any time via the ADD/EDIT dialog's PAGE selector (only shown when no group is picked, since a grouped action always follows its group's page). Favourites are NOT page-scoped — they stay visible above the page tabs regardless of which page is active, since "your top picks" is a global concept. The single-page case (the vast majority of installs) renders with no tab strip at all — the feature is fully invisible until a second page is added, via an "ADD PAGE" link in the management bar (visible whenever `settings:write` is granted). Deleting a page reassigns its groups/ungrouped actions back to Home rather than deleting anything.

---

## Audio Devices

List available playback devices, see which is default, switch the default, and set volume.

| Layer | File |
|-------|------|
| Types / schemas | `src/types/audio-devices.ts` |
| Util | `src/utils/audio-devices.ts` |
| API — list | `GET /api/audio-devices` |
| API — action | `POST /api/audio-devices/[id]/action` (body: `SetVolumeAction` or `SetDefaultAction`) |
| Component | `src/components/AudioDeviceSelector.tsx` |
| Hooks | `src/hooks/audio-devices/` |
| Backing interop | `src/utils/native-audio.ts` — native Core Audio COM interop (`IMMDeviceEnumerator`/`IAudioEndpointVolume`/`IPolicyConfig`), no external tool — see [windows-dependencies.md](windows-dependencies.md) |

No external tool — `audio-devices.ts` calls into `native-audio.ts`'s C#-via-`Add-Type` interop directly. Active devices are filtered to active render (playback) endpoints.

---

## Display Profiles

Capture the current monitor layout (position, resolution, refresh rate, HDR) as a named profile, then reapply it later in one tap — no external tool, no hand-authored config.

| Layer | File |
|-------|------|
| Util | `src/utils/display-profiles.ts` → `captureDisplayProfile(label)`, `updateDisplayProfile(id)`, `renameDisplayProfile(id, label)`, `deleteDisplayProfile(id)`, `reorderDisplayProfiles(orderedIds)`, `getActiveDisplayProfileId()`, `setDisplayProfile(id, allowChanges?)` |
| Backing interop | `src/utils/native-display.ts` — native Windows CCD API (`QueryDisplayConfig`/`SetDisplayConfig`), no external tool — see [windows-dependencies.md](windows-dependencies.md) |
| API | `POST /api/display/switch`, plus routes under `src/app/api/display/profiles/` for capture/list/rename/delete/reorder/active-detection |
| Component | `src/components/DisplayControl.tsx` |
| Hooks | `src/hooks/displays/` |

A profile (`DisplayProfileConfig`: `id`, `label`, `json`, `fingerprint`) is captured, not hand-authored — arrange your monitors, then "Capture" in the Output tab. `json` is an opaque blob (native-display.ts's own serialization) applied later via `SetDisplayConfig`; `fingerprint` is a LUID-independent signature used to detect which saved profile (if any) matches the live setup, since adapter LUIDs go stale across reboots/driver restarts. Matching identifies targets by EDID manufacturer/product code + connector instance, not raw numeric target IDs (those were found to shift across captures for the same physical monitor).

Applying a profile tries a byte-exact `SetDisplayConfig` first; if that specifically fails with `ERROR_BAD_CONFIGURATION` (hresult 1610), the API surfaces `canRetryWithChanges: true` so the UI can offer a retry that lets Windows adjust minor mode details (`allowChanges: true`).

The LUID-remap-at-apply-time approach is adapted from [mastersign/Mastersign.DisplayManager](https://github.com/mastersign/Mastersign.DisplayManager) (MIT).

---

## Fan Control

List available fan profiles, see the active profile, and switch profiles.

| Layer | File |
|-------|------|
| Types | `src/types/fan-control.ts` |
| Util | `src/utils/fan-control.ts` |
| API — list/active | `GET /api/fan-control` — `{ available, activeProfile, availableProfiles }`; `available: false` (not installed / never run at the configured path) shows a "FanControl not found" state instead of an empty list |
| API — activate | `POST /api/fan-control/[id]/activate` |
| Component | `src/components/FanControlSelector.tsx` |
| Hooks | `src/hooks/fan-control/` |
| External tool | FanControl.exe — see [windows-dependencies.md](windows-dependencies.md) |

Profile names are JSON filenames from `C:/Program Files (x86)/FanControl/Configurations/` (excluding `CACHE`). Activation calls `FanControl.exe --config <profileFileName>` and writes the activated profile to `temp/active-fan-profile.json`.

---

## RTSS (RivaTuner Statistics Server)

Manage per-game framerate limit profiles. List profiles, view the active profile (based on running processes), read and patch config, copy profiles.

| Layer | File |
|-------|------|
| Types / schemas | `src/types/rtss.ts` |
| Util | `src/utils/rtss.ts` |
| API — list | `GET /api/rtss/profiles` |
| API — config | `GET /api/rtss/profiles/[id]/config` |
| API — patch config | `POST /api/rtss/profiles/[id]/config` |
| API — copy profile | `POST /api/rtss/profiles/[id]/copy` |
| API — start/stop/restart | `POST /api/rtss/process?action=start\|stop\|restart`, `GET /api/rtss/process` (running state) |
| API — availability | `GET /api/rtss/availability` — `{ available }`; the section shows an "RTSS not found" state instead of an empty profile list when false |
| Components | `src/components/rtss/RTSSSection.tsx`, `ProfileSelector.tsx`, `ProfileCreateDialog.tsx` |
| Hooks | `src/hooks/rtss/` |
| External tool | RTSS — see [windows-dependencies.md](windows-dependencies.md) |

RTSS profiles are `.cfg` files (INI format) in `C:/Program Files (x86)/RivaTuner Statistics Server/Profiles/`. The Global profile has no extension. Patching uses lodash `_.merge` to deep-merge a partial config over the existing one, re-validates via Zod, then writes back as INI.

RTSS is started/stopped by `RtssService` (`src/utils/rtss.ts`) spawning/killing `RTSS.exe` directly (`Stop-Process -Name RTSS`) — not a scheduled task, since HandyMon's own process already runs elevated and there's no separate privilege gap to bridge.

---

## Process Lasso

View and edit per-process rules: CPU affinity (which cores a process may use), I/O priority, CPU priority, and "Induce Performance Mode". The UI shows one row per process, merging four independent Process Lasso config lists by exe name — a process can have any combination of these set.

| Layer | File |
|-------|------|
| Types / schemas | `src/utils/proces-lasso/process-lasso.ts` |
| Config file util | `src/utils/proces-lasso/process-lasso-config.ts` |
| API — get/set config | `GET/POST /api/process-lasso/config` |
| API — update CPU set | `POST/DELETE /api/process-lasso/config/cpu-sets/[id]`, reorder at `.../cpu-sets/reorder` |
| API — update I/O priority | `POST/DELETE /api/process-lasso/config/io-priorities/[id]`, reorder at `.../io-priorities/reorder` |
| API — update CPU priority | `POST/DELETE /api/process-lasso/config/cpu-priorities/[id]`, reorder at `.../cpu-priorities/reorder` |
| API — update Induce Performance Mode | `POST/DELETE /api/process-lasso/config/performance-mode/[id]` — no body, POST enables/DELETE disables |
| API — bulk edit | `POST /api/process-lasso/config/bulk` — applies any combination of cores/priority/cpuPriority/performanceMode to multiple exes in one read-modify-write cycle |
| API — availability | `GET /api/process-lasso/availability` — `{ available, coreCount }`; the section shows a "Process Lasso not found" state instead of an empty list when `available` is false |
| Component | `src/components/process-lasso/ProcessLassoSection.tsx` |
| External tool | Process Lasso config file — see [windows-dependencies.md](windows-dependencies.md) |

**Presets** (`ProcessRulePreset`, see [data-models.md](data-models.md#process-rule-presets)) can define cores, I/O priority, CPU priority, and/or Induce Performance Mode in any combination, are edit-in-place (not just delete+recreate) via `ManagePresetsDialog` (which shows only the form for the preset being edited, not the rest of the list), and preset↔rule matching is inferred live by value (`matchProcessRulePreset`), not stored as a link. This powers: a preset-match badge on each row, "select all matching a preset" in SELECT mode (bulk-select every rule currently matching a preset's definition), and an "apply preset" quick-fill in the bulk-edit dialog (alongside manual controls for each field). Reordering (`REORDER` button) is drag-and-drop via window-level pointer listeners.

A filter box above the list (hidden while reordering, since filtering would desync the drag-index math) narrows the row list by exe name substring — useful once there are dozens of entries.

The config is an INI file read from `C:\ProgramData\ProcessLasso`. `CPUSets`, `DefaultIOPriorities`, and `DefaultPriorities` (all under `[ProcessDefaults]`) are flat comma-separated `exe,value[,exe,value...]` strings — CPU sets pack a core-range spec per exe (`exe,(core-range;core-range,...)`), I/O priority packs a single Windows `IO_PRIORITY_HINT` level per exe (0=Very Low, 1=Low, 2=Normal, 3=High), CPU priority packs a Windows priority class as a lowercase string per exe (`idle`/`below normal`/`normal`/`above normal`/`high`/`realtime` — only `above normal` has been empirically confirmed against a live config, the rest are inferred by symmetry). `AutomaticGamingModeProcessPaths` (under `[GamingMode]`) is what "Induce Performance Mode" actually is — a plain comma-separated exe list with no values (membership = enabled), confirmed via a before/after diff. Each list is parsed into a typed array at runtime and serialised back on write; all four lists are read/written independently but merged for display. GPU priority (`DefaultGPUPriorities`) is not yet implemented — its value format hasn't been confirmed against a live config.

---

## Services

Generic start/stop control for any Windows service or scheduled task the admin configures — not tied to a specific program. Replaced the earlier hardcoded "Apollo" (Sunshine streaming) feature.

| Layer | File |
|-------|------|
| Types / schemas | `ServiceConfig` in `src/types/app-config.ts` |
| Util | `src/utils/services.ts` (config lookup), `src/utils/service.ts` (`makeServiceFromName`), `src/utils/service-controller-route.ts` (route helper) |
| API | `GET /api/services`, `GET /api/services/discover`, service action routes under `src/app/api/services/` |
| Component | `src/components/ServicesConfigSection.tsx` (admin config), `src/components/ServicesSection.tsx` (control UI) |
| Grant | `services:control` (per-service `allowControl` flag gates whether a given entry can be controlled at all; the device-level grant gates whether a device can control any of them) |

Each `ServiceConfig` entry names a Windows service (`net start`/`net stop`) or scheduled task (`schtasks /run`/`/end`) by exact name. New installs start with zero configured services — add your own in Settings.

---

## Processes

List running processes with CPU usage (sampled over 1 second), per-process detail, and kill/close — the top-level Processes tab (`TaskSwitcherSection.tsx`).

| Layer | File |
|-------|------|
| Types | `src/types/processes.ts` |
| Util | `src/utils/processes.ts` |
| API — full list | `GET /api/processes/list` |
| API — per-PID usage | `GET /api/processes/usage` — fast CPU%/RAM via WMI perf counters (`getProcessUsage()`), decoupled from the slower full-list sample |
| API — detail | `GET /api/processes/detail` — path/command line/thread count/uptime for one PID (`getProcessDetail()`) |
| Component | `src/components/TaskSwitcherSection.tsx` (main Processes tab), `src/components/ProcessSelector.tsx` (picker used elsewhere, e.g. Process Lasso config) |

Takes two PowerShell `Get-Process` samples 1 second apart and computes a delta CPU percentage. Used by RTSS feature to detect which game is running.

---

## Performance Monitoring (Perf)

CPU/GPU/RAM usage, hardware sensors (temps/power/clocks/fan RPM via LibreHardwareMonitor), and in-game FPS/frametime capture (via PresentMon) — the top-level Perf tab (`PerfSection.tsx`), with Temps/Power/Fans sub-tabs (`SensorTabs.tsx`) and a dedicated Frame page for FPS. See [windows-dependencies.md](windows-dependencies.md#librehardwaremonitor--pawnio-for-temperature--power--clock--fan-data) for the LHM/PawnIO/PresentMon external-tool setup this feature depends on.

| Layer | File |
|-------|------|
| Util — usage/sensors | `src/utils/perf.ts` (Performance Counters + WMI, no external tool needed), `src/utils/lhm.ts` (LibreHardwareMonitor parsing, `extractSensorGroups()`) |
| Util — FPS | `src/utils/presentmon.ts` — persistent PresentMon capture manager, runs only while the Frame page polls |
| Util — capture runs | `src/utils/captures.ts` — dedicated per-run PresentMon capture → CapFrameX-compatible CSV, with capture-history list/open/delete |
| Util — capture sensors | `src/utils/capture-sensors.ts` — server-side, once-a-second LHM + disk/network/RAM sampler that runs alongside a capture, written as `<base>.sensors.jsonl`; lets the capture viewer show what the system was doing at any hitch, not just the frametime spike itself |
| Util — comparisons | `src/utils/comparisons.ts` — orchestrates a **Comparison**: a named group of 2+ labeled **Variants**, each a completely normal Capture (same CSV/summary/sensors) written into the comparison's own `captures/comparisons/<id>/` subfolder instead of the flat capture list. Owns start/pause/continue/finish lifecycle and the `manifest.json` read/write; reuses `captures.ts`/`capture-sensors.ts`/`presentmon.ts` unmodified via their `dir`/`onFinalize` params rather than duplicating capture logic |
| API — stats | `GET /api/perf/stats` (CPU/GPU/RAM + sensors), `GET /api/perf/advanced` (extra detail view), `GET /api/perf/sensors-status` |
| API — FPS | `GET /api/perf/fps` (lightweight, polled), `POST /api/perf/fps-restart`, `POST /api/perf/fps-pin` / `fps-unpin`, `POST /api/perf/fps-reset`, `GET /api/perf/fps-candidates` |
| API — capture runs | `POST /api/perf/capture` (start a dedicated capture run), `GET /api/perf/captures` (history), `POST /api/perf/captures/open` (open in CapFrameX) |
| API — comparisons | `GET/POST /api/perf/comparison` (live comparison status + `?action=start\|pause\|continue\|finish`), `GET /api/perf/comparisons` (history list, or `?id=` for one comparison's full manifest + variant data), `DELETE /api/perf/comparisons?id=` |
| API — tool tests | `GET /api/perf/lhm-test`, `GET /api/perf/presentmon-test`, `GET /api/perf/presentmon-debug`, `GET /api/perf/frametype-probe` |
| API — sensor detail | `GET /api/perf/lhm-sensors` |
| Components | `src/components/perf/` — `PerfSection.tsx`, `PerfOverview.tsx`, `SensorTabs.tsx`, `CpuChart.tsx`/`GpuChart.tsx`/`MemoryChart.tsx`/`FrameChart.tsx`, `FrameToolbar.tsx`, `CaptureHistory.tsx` (capture + comparison history, tabbed), `ComparisonView.tsx` (comparison table/chart viewer + per-variant drill-down), `ManageExclusionsDialog.tsx`, `AddCardDialog.tsx`, plus `cards/` (per-metric card components, including the advanced-stat cards) |
| Grants | `perf:read`, `perf:capture` (also gates COMPARE/PAUSE/CONTINUE/FINISH) |

A **Comparison** answers "which settings are actually better", built either of two ways: hit COMPARE on the Frame toolbar to record variants live — label the comparison and first variant (both optional), record; PAUSE to change settings without ending the comparison, CONTINUE to record the next labeled variant (optionally toggling "match `<first variant>`'s duration" to auto-stop at the same length), FINISH to end and jump straight to the viewer — **or**, in HISTORY → CAPTURES, hit COMPARE to multi-select two or more *already-taken* captures and build a Comparison from them after the fact (each capture's csv/sidecar/sensors are copied into the new comparison's folder as-is — no re-capture, no recompute; only the label is editable per capture). The viewer defaults to a table (best value per column highlighted), with a CHART toggle for an overlaid multi-variant frametime chart, a REGION toggle for picking a comparable time slice per variant when durations differ (drag a fixed-width window per variant, release to save — the table then prefers that windowed slice's stats, tagged with a REGION badge), and a UTILIZATION toggle (default off) for AVG GPU%/AVG CPU% columns; tapping a row drills into that variant's own single-capture detail view (hitch markers + sensor snapshot), unchanged from a standalone capture. No pruning/retention for comparisons — they're a deliberate, occasional action, not something that piles up like individual captures.

---

## Keyboard

Sends keystrokes/text to the host PC remotely — the top-level Keyboard tab (`VirtualKeyboardSection.tsx`). Also used internally by Action hotkey/text steps (see [Actions](#actions)).

| Layer | File |
|-------|------|
| Util | `src/utils/virtual-keyboard.ts` |
| API — send key | `POST /api/keyboard/key` |
| API — type text | `POST /api/keyboard/type` |
| Component | `src/components/VirtualKeyboardSection.tsx` |
| Grants | `keyboard:execute` |
