# Development

## Running Locally

```bash
npm run dev
```

Starts the Next.js dev server with Turbopack on **http://localhost:3001** (deliberately not 3000 — kept free for other projects that default there). Hot reload works for both frontend and API routes.

This is entirely separate from the production scheduled task on port 44558 — both can run simultaneously without conflict.

## npm Scripts

| Script | What it does |
|--------|-------------|
| `npm run dev` | Dev server on port 3001 (Turbopack, hot reload). `predev` compiles native interop first. |
| `npm run compile-native` | Compiles every native-interop C# module (`native-src/*.cs`) via `scripts/compile-native.js` — see [docs/startup.md](startup.md#native-interop-compilation). Runs automatically as `predev`/`predev:secure`/`prebuild`; rarely needs to be run by hand. |
| `npm run build` | Production build into `.next/`. `prebuild` compiles native interop first. |
| `npm run start` | Start production build on default port (3000) |
| `npm run start:prod` | Start production build on the configured port (default 44558) |
| `npm run start-service` | Start the "HandyMon" scheduled task |
| `npm run stop-service` | Stop the "HandyMon" scheduled task |
| `npm run restart-service` | Stop the task, wait 2s, start it again — run `npm run build` first after pulling changes |
| `npm run start:tray` | Run the tray wrapper (`tray-main.js`, uses the production build) — no Electron, native `NotifyIcon` loaded from a precompiled DLL. Accepts `--port=` to avoid colliding with an already-running instance. |
| `npm run package:win` | Build + package a real Windows installer (`scripts/package-win.js`) — see [docs/startup.md](startup.md#packaged--installed-build) |
| `npm run lint` | Run Next.js ESLint |

## Adding a Feature

1. Add types/schemas to `src/types/<feature>.ts`
2. Add backend logic to `src/utils/<feature>.ts`
3. Add API route(s) to `src/app/api/<feature>/`
4. Add React Query hook(s) to `src/hooks/<feature>/`
5. Add component(s) to `src/components/`
6. Wire the component into `src/app/page.tsx`
7. Update [docs/features.md](features.md)

## Testing API Routes

In dev, hit routes directly:
```
GET  http://localhost:3001/api/config
POST http://localhost:3001/api/actions/office-lighting/execute
GET  http://localhost:3001/api/fan-control
```

Or use the UI at http://localhost:3001.

## TypeScript

Strict mode is enabled. Run `npx tsc --noEmit` to type-check without building.

API route request body validation is done via Zod — `.parse()` throws on invalid input which Next.js catches and returns as a 500. For user-facing validation errors, catch the `ZodError` and return a 400 manually.

## Dependencies

Notable non-obvious choices:
- `iconv-lite` — Process Lasso's INI config file is UTF-16 with a BOM; Node's default encoding doesn't handle this
- `ini` — parses/writes Windows INI files (RTSS `.cfg`, Process Lasso `.ini`)
- `lodash` — used for `_.merge` in RTSS config patching
