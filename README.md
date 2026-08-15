# HandyMon

A local-network web dashboard for controlling a Windows PC — switching display configurations, audio devices, and fan profiles, running one-tap Actions, and more, from a phone or any browser on the LAN.

Runs as a Next.js app on your PC; pair a phone or another browser with a QR code and control the PC from there. Everything stays on your local network — there's no cloud component and no external service dependency for the app itself.

## Features

- **Actions** — build a sequence from launch/hotkey/keysequence/text/delay/display/audio/fan steps (and other Actions) and trigger it in one tap — a single Action can switch display layout, audio output, and fan profile, then launch a game, all in order
- **Display switching** — native Windows CCD API interop, no external tool required
- **Audio device switching + volume control** — native Windows Core Audio COM interop, no external tool required
- **Fan profiles** — via FanControl
- **Live performance monitoring** — CPU/GPU temps, power, clocks, fan RPM (via LibreHardwareMonitor), and in-game FPS/frametime capture (via PresentMon)
- **Process management** — CPU/RAM usage, kill/close, CPU-affinity control (via Process Lasso)
- **Generic Services** — start/stop any Windows service or scheduled task you configure
- **Device pairing** — QR-code pairing with per-device permission grants; the host PC always has full access, paired devices get only what you grant them

See [docs/features.md](docs/features.md) for the full feature-by-feature breakdown.

## Requirements

- Windows 11 (uses Windows-specific tools and APIs throughout)
- Node.js 20+
- Whichever of the external tools above you want to use — each is optional independently; see [docs/windows-dependencies.md](docs/windows-dependencies.md) for install links and configuration

## Getting Started

See [SETUP.md](SETUP.md) for a full first-run walkthrough (installing dependencies, configuring tool paths, adding your first Action).

Quick version:

```bash
npm install
npm run dev
```

Open the URL it prints (Next.js dev server default). For a production-like run on the real port (44558):

```bash
npm run build
npm run start:prod
```

For always-on background operation (tray icon + auto-start at logon), see [docs/startup.md](docs/startup.md).

## Documentation

- [CLAUDE.md](CLAUDE.md) — project orientation (tech stack, directory layout, key facts)
- [docs/architecture.md](docs/architecture.md) — request lifecycle, React Query pattern, service abstraction
- [docs/features.md](docs/features.md) — every feature: API routes, utils, components, hooks
- [docs/windows-dependencies.md](docs/windows-dependencies.md) — all external tools and hardcoded paths
- [docs/data-models.md](docs/data-models.md) — key types and Zod schemas
- [docs/startup.md](docs/startup.md) — scheduled task, tray wrapper, port config
- [docs/development.md](docs/development.md) — dev workflow, npm scripts

## License

MIT — see [LICENSE](LICENSE).
