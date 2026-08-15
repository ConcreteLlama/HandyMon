# HandyMon

A local-network web dashboard for controlling a Windows PC — switching display configurations, audio devices, and fan profiles, running one-tap Actions, and more, from a phone or any browser on the LAN.

**Target environment:** Windows 11, local network only, mobile-first browser UI.

## Tech Stack

- **Next.js 15** (App Router) — both the frontend and API routes
- **React 19 + TanStack React Query 5** — all server state; hooks in `src/hooks/`
- **Material UI 7** — UI components, dark theme
- **Zod 3** — validates all external data (INI files, JSON configs, API request bodies)
- **TypeScript** throughout

No Electron — the tray icon is a native `System.Windows.Forms.NotifyIcon` (see `tray-native.js`), not a bundled Chromium. The dashboard is always viewed in the user's own browser (phone or desktop), never rendered inside the tray process itself.

All native Windows interop (audio, display, the persistent worker, the tray icon) is real C# under `native-src/*.cs`, compiled ahead of time by `scripts/compile-native.js` — **never at runtime**. See [docs/startup.md](docs/startup.md#native-interop-compilation).

## Quick Orientation

```
src/app/api/      API route handlers (one folder per feature)
src/utils/        Backend logic — calls Windows tools, reads/writes config files
src/components/   React UI components
src/components/help/ Global tap-to-target help mode (see Help Mode below)
src/hooks/        React Query hooks (one folder per feature)
src/types/        Shared TypeScript types and Zod schemas
src/config.ts        Thin config getters (RTSS, Process Lasso) over user-configurable tool paths
native-src/           C# source for native interop (audio/display/worker/tray) — compiled by scripts/compile-native.js
scripts/compile-native.js  Compiles native-src/*.cs into native/ — the only place any of it is ever compiled
tray-main.js         Production entry point (tray icon + embedded Next.js server)
tray-native.js        Native tray icon, loads a precompiled DLL, long-running child process
read-port.js          Shared port-from-config.json reader for tray-main.js/server.js
launch-hidden.ps1      Launches node.exe without a visible console window (Scheduled Task action target)
help.html              Getting-started page bundled into the installer; opened on first launch + from a Start Menu shortcut
```

## Key Facts

- Runs on **port 44558** in production
- Started via a Windows scheduled task named **"HandyMon"**
- Device pairing (QR code) + per-device permission grants gate remote access — the host device (localhost) always has full access regardless of grants
- Most Windows tool paths default to their standard install location but are user-configurable in Settings → Tool Paths — see [docs/windows-dependencies.md](docs/windows-dependencies.md)
- Actions (the main feature) are each a sequence of steps — launch/hotkey/keysequence/delay/text/nested-action/display/audio/fan — run in order; user-configurable, stored in `AppConfig.actions`/`actionGroups` (see `src/utils/app-config.ts`) and edited via `ActionsSection.tsx` — not hardcoded

## Documentation

- [Architecture](docs/architecture.md) — request lifecycle, React Query pattern, service abstraction
- [Features](docs/features.md) — every feature: API routes, utils, components, hooks, external tools
- [Windows Dependencies](docs/windows-dependencies.md) — all hardcoded paths and external tools
- [Utilities Registry](docs/utilities.md) — every `src/utils/` module, its purpose, and its main exports
- [Data Models](docs/data-models.md) — key types and Zod schemas
- [Startup & Deployment](docs/startup.md) — scheduled task, tray wrapper, port config
- [Development](docs/development.md) — dev workflow, npm scripts
- [Maintenance](docs/maintenance.md) — rules for keeping docs current

## Shared UI Components

Reusable primitives live in `src/components/ui/`. Always use these instead of inlining:

| Component | Purpose |
|---|---|
| `fieldStyle` | Common CSS object for `<input>` and `<select>` elements |
| `FormLabel` | Section label with optional hint text (replaces local `lbl()` functions) |
| `DialogHeader` | Title row with close button for modals |
| `DialogButtons` | Cancel/Save button row for modals |
| `ToggleSwitch` | Inline toggle with `size="sm"\|"md"` |
| `SelectableCard` | Profile/option card with active state and loading spinner |
| `ServiceStatusIcon` | 48×48 service icon box with status dot |
| `ServiceToggleButton` | Start/Stop button with pending state |
| `SwipeableTabs` | Horizontal tab strip with swipe-between (pointer) gestures and height-aware panels; optional `bar` slot and `swipeEnabled` flag. Used by System and Perf sections. |
| `ProcessRulePicker` | Per-core checkbox grid (sized to the host's actual core count) plus save/apply/delete for named process-rule presets (cores, I/O priority, icon). Used by Process Lasso settings and the Processes tab CPU-set-assign control. |
| `ModalShell` | Portal + overlay + centered panel chrome — pair with `DialogHeader`/`DialogButtons`. Used by every modal except `ProcessLassoSection`/`ServicesConfigSection`, which still use raw MUI `Dialog` (not yet migrated). |
| `DeleteConfirmDialog` | Shared delete confirmation with an optional `blockedMessage` slot (e.g. "can't delete, still referenced by X"). |

**Rules:**
- Before adding a new inline pattern, check if a shared component already covers it.
- When you add a pattern that appears (or will appear) in 2+ places, extract it to `src/components/ui/`.
- PowerShell execution in API routes must go through `runPsScript()` from `src/utils/windows.ts` — never inline the encode+exec pattern.

## Help Mode

A global tap-to-target help system, since native `title` tooltips don't work on touch/mobile. `src/components/help/HelpModeContext.tsx` holds the `active` flag (toggled from the "?" icon in `AppShell.tsx`'s section header) and exports `helpProps(title, body)`. `src/components/help/HelpOverlay.tsx` (mounted once in `Providers.tsx`) does the rest: while active, a capture-phase click listener intercepts every click app-wide, blocking whatever it would normally do, and shows a positioned popover if the click landed on (or inside) an element carrying `data-help-title`/`data-help-body`. Escape closes the popover first, then exits help mode; clicking the toggle button exits immediately.

**To make a control help-mode-tappable:** spread `{...helpProps('Short Title', 'One or two sentences explaining it.')}` onto its outer `Box` (or any element) — no wrapper needed, since the click interceptor walks up via `closest('[data-help-title]')`. `CardTitle` (perf cards, `src/components/perf/cards/shared.tsx`) and `FormLabel` (`src/components/ui/FormLabel.tsx`) both take an optional `help` prop that does this for you on their label text.

**Rule:** any element exempt from interception (the help toggle button itself, the popover's own close button) must carry `data-help-ignore`, or clicking it while help mode is active gets swallowed instead of working normally.

## Onboarding Tips

The proactive opposite of Help Mode above: unprompted "look here" popups for first-time users, instead of opt-in tap-to-explore. **Host-only** — config/setup (especially Actions) happens on the host, so paired remote devices never fetch or see these; enforced both client-side (`useIsLocalhost()` in `OnboardingOverlay`) and server-side (`localhostOnly()` on both API routes, not just client hiding).

`src/components/onboarding/tips.ts` is the single source of truth: a small, deliberately non-comprehensive `ONBOARDING_TIPS` array (`id`, `section`, `version`, `title`, `body`), and `tipProps(id)` — spread onto a target element like `helpProps()`, but only `data-tip-id` (the rest is looked up from the registry, not duplicated into the DOM). `src/components/onboarding/OnboardingOverlay.tsx` (mounted once in `Providers.tsx`) shows at most one tip at a time — whichever comes first in registry order among tips not yet dismissed at their current version *and* currently mounted (a `MutationObserver` re-scans on DOM changes so the next eligible tip picks up once the current one clears). Dismissal state is a flat `tipId -> acknowledged version` map, persisted server-side in its own file (`src/utils/onboarding.ts`, `%LOCALAPPDATA%\HandyMon\onboarding.json`) — no per-device tracking, since it's host-only.

**Versioning, not history:** bumping a tip's `version` in the registry makes it reappear for anyone who dismissed the older version — no dismissal log needed, just "did they ack the current version or not."

**Three dismiss scopes, same underlying call:** the popover's DISMISS / DISMISS SECTION / DISMISS ALL buttons all just call the same mutation with a different-sized `{tipId: version}` map — one tip, every tip in that tip's section, or every tip in the registry, respectively. The server-side route doesn't know about scopes at all, just "mark these tip versions as seen."

**Page-agnostic notices** (no DOM anchor, e.g. `src/components/onboarding/FirstRunPairDialog.tsx`) reuse the same `useOnboardingDismissals()` store and host-only gating, but render as a centered `ModalShell` dialog instead of an anchored popover, mounted unconditionally in `Providers.tsx` rather than living in the `ONBOARDING_TIPS` registry (nothing to anchor to). Two things this pattern has to get right that anchored tips don't: (1) gate on a client-mounted flag, not just the dismissal query resolving — `ModalShell` portals into `document.body`, which doesn't exist during SSR; (2) pass `ModalShell`'s `zIndex` prop above `OnboardingOverlay`'s tip popover (2500), or a simultaneously-visible tip renders on top and silently eats the dialog's clicks.

## Permission Grants

Every paired (non-host) device has a set of permission grants gating what it can do — see `src/types/grants.ts` (the grant vocabulary, grouped by feature/section) and `src/utils/grants.ts` (`requireGrant()`, the per-route guard, called the same way as the older `localhostOnly()` pattern). The host device (localhost) always has full access regardless of grants.

**Rule: any time a feature is added or removed, its API routes must get an appropriate permission gate, and that gate must be configurable — not hardcoded.** An ungated route is invisible to the permission system entirely, so a device restricted to "View Only" would silently get full access to anything left ungated.

- Call `requireGrant(req, 'group:grant')` at the top of every new route handler.
- If the feature needs a new grant, add it to `GRANT_GROUPS` in `src/types/grants.ts` — it automatically appears in the pairing/edit-device permissions UI (`PermissionsEditor.tsx`, grouped, with bulk-select support), no other UI work needed.
- If a feature is removed, remove its grant(s) from `GRANT_GROUPS` too — don't let the vocabulary accumulate dead entries (see the Apollo→generic-Services migration for the pattern: the feature became config-driven, so `apollo:*` was replaced with `services:*` rather than kept alongside it).
- Client-side hiding via `useGrants()` (nav items, action buttons) is polish on top of the server-side gate, not a substitute for it.

## Maintenance

When making changes, update the relevant doc. See [docs/maintenance.md](docs/maintenance.md) for the full rules.
