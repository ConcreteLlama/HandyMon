# Architecture

## UI Layout

The app uses a shell-based navigation model (`src/components/AppShell.tsx`):
- **Desktop (≥ 768px):** Fixed 220px sidebar on the left with nav items; scrollable main content area on the right
- **Mobile (< 768px):** Full-width content with a fixed bottom navigation bar (60px)
- Navigation state (`active` section) is local React state in `AppShell`, mirrored to the URL query (`?section=`) so it survives reload/deep-link. It's read back from the URL in a mount effect (not the `useState` initializer) to stay hydration-safe.
- Sections (default order, user-reorderable — see `src/components/nav-items.ts`): Actions, Output (Display + Audio), Gaming (RTSS), Perf, Processes, System, Keyboard, Settings
- The **System**, **Perf**, and **Output** sections use the shared `SwipeableTabs` primitive (swipe/tap sub-tabs), each persisting its active sub-tab to the URL (`?systemtab=`, `?perftab=`, `?outputtab=`). System sub-tabs: Fans, Lasso, Services. Pairing (`PairSection`) lives in **Settings** instead — it's host config, alongside tool paths and nav order.
- Fonts: Rajdhani (display/headings, loaded via `next/font/google`), DM Sans (body), JetBrains Mono (data values)
- Design tokens live in CSS custom properties in `globals.css` (`--accent`, `--bg-raised`, etc.)

## Process Model

The scheduled task ("HandyMon") runs the tray path — that's the actual production entry point. `npm run start:prod` (headless, no tray icon) is a documented alternative, not what the task runs. No Electron/Chromium anywhere — the dashboard is always viewed in the user's own browser (phone or desktop), never rendered inside the tray process, so an embedded browser engine was never actually needed. The tray icon itself is native (`tray-native.js`, a `System.Windows.Forms.NotifyIcon` — source in `native-src/tray-interop.cs`, compiled ahead of time by `scripts/compile-native.js` — spawned as a long-running child PowerShell process — menu clicks are reported back over stdout as plain lines like `OPEN_UI`/`PAIR`/`QUIT`).

**Tray wrapper (the actual production path):**
```
tray-main.js
  ├─ tray-native.js — spawned child process, native tray icon + menu, stdout events
  └─ http.createServer(...) on the configured port (read-port.js, default 44558)
       ├─ server-guard.js  (rejects spoofed Host: localhost requests — see below)
       └─ Embedded Next.js server (same next build, spawned in-process via require('next'))
```

**Standalone (headless alternative):**
```
node server.js   (npm run start:prod)
  └─ http.createServer(...) on the configured port
       ├─ server-guard.js  (same guard as the tray path)
       └─ Next.js server (require('next'), dev: false)
```

Both serve the same Next.js app and both go through `server-guard.js` — a thin wrapper around Next's request handler that checks the real TCP connection's origin (`req.socket.remoteAddress`) against the `Host` header, and rejects the request with 403 if `Host` claims `localhost`/`127.0.0.1` but the connection didn't really come from loopback. This exists because `src/middleware.ts`, `src/utils/request-utils.ts`, and `src/utils/grants.ts` all trust that header to decide whether a request is from the host device (and therefore exempt from pairing/grants) — without this guard, that trust is spoofable by any non-browser HTTP client on the LAN. **Known gap**: `npm run dev` (`next dev --turbopack`) doesn't go through this guard, since it isn't wrapped in a custom server — only the two production paths above are protected.

## Request Lifecycle

```
Browser (React)
  → React Query hook  (src/hooks/<feature>/)
  → fetch() to /api/<feature>/...
  → [production only] server-guard.js — rejects spoofed Host: localhost requests
  → Next.js middleware  (src/middleware.ts — auth check)
  → Next.js API route handler  (src/app/api/<feature>/route.ts)
  → Utility function  (src/utils/<feature>.ts)
  → Windows tool / config file / PowerShell
  → Response back up the chain
```

All API routes are Next.js App Router route handlers (`export async function GET/POST`). There is no separate Express server.

## React Query Pattern

Every piece of server state follows the same pattern:

1. **Query hook** — `useQuery({ queryKey, queryFn })` wrapping a fetch call
2. **Mutation hook** — `useMutation({ mutationFn })` with `onSuccess: () => queryClient.invalidateQueries({ queryKey })`
3. **Components** consume hooks directly; no prop-drilling of server state

Query keys are colocated with hooks in `query-keys.ts` files where there are multiple hooks per feature.

## Zod Validation

All data that crosses a system boundary (INI files, JSON cache files, API request bodies) is parsed through a Zod schema before use. This means TypeScript types for external data are derived from Zod schemas (`z.infer<typeof SomeSchema>`) rather than written by hand.

Key validated boundaries:
- RTSS `.cfg` files (INI → `RtssConfigSchema`)
- FanControl `CACHE` file (JSON → fan-control types)
- Process Lasso INI config (`ProcessLassoRuntimeConfigSchema`)
- All API POST request bodies (validated in route handlers)

## Service / Task Abstraction

`src/utils/service.ts` provides a `makeService(startCmd, stopCmd, serviceName, type, defaultDelay?)` factory that wraps Windows service and scheduled task control into a uniform interface with `start()`, `stop()`, `restart()`, and `isRunning()` methods.

`makeServiceFromName(serviceName, type, restartDelay?)` is a shorthand that builds the `schtasks`/`net` commands from the service name. `RtssService` doesn't use either — see below — it implements the same shape directly around a spawned process instead.

Used by:
- `src/utils/rtss.ts` — `RtssService` (direct process spawn/kill, not a scheduled task)
- `src/utils/services.ts` — `controllerFor(cfg)` builds a controller per admin-configured `ServiceConfig` via `makeServiceFromName(cfg.serviceName, cfg.type)`, backing the generic Services feature (any Windows service or scheduled task, not tied to a specific program — see [features.md](features.md#services))

## Display Switching

Monitor layouts are captured and applied directly via Windows' own CCD (Connecting and Configuring Displays) API — `QueryDisplayConfig`/`SetDisplayConfig` — no external tool or batch scripts. `src/utils/native-display.ts` implements the interop (C# source in `native-src/display-interop.cs`, compiled ahead of time by `scripts/compile-native.js` into a DLL that `native-display.ts` loads via `Add-Type -Path`); `src/utils/display-profiles.ts` is the higher-level API that stores/retrieves profiles in `AppConfig.displayProfiles` and calls into it. See [features.md](features.md#display-profiles) for the capture/apply/fingerprint-matching flow.

## Fan Profile Detection

FanControl doesn't expose a reliable API for the currently active profile. The app uses two sources and picks whichever is newer:
1. FanControl's own `CACHE` file at `C:/Program Files (x86)/FanControl/Configurations/CACHE`
2. A local `temp/active-fan-profile.json` written by the app each time it activates a profile

## RTSS Active Profile Detection

RTSS applies per-process profiles automatically based on the running executable name. The app mirrors this: `getActiveRtssProfile()` lists running processes and finds the first RTSS profile whose name matches a running process (`{profileName}.exe`). Falls back to the Global profile.
