# First-Run Setup

HandyMon ships with a blank slate — no Actions, audio devices, or Services configured. Everything below is done once, from the web UI itself, after the server is running.

## 1. Install and start the app

```bash
npm install
npm run build
npm run start:prod
```

This runs the app on `http://localhost:44558`.

For always-on operation (auto-start at logon, tray icon), see [docs/startup.md](docs/startup.md).

## 2. Log in and pair a device

Open `http://localhost:44558` on the PC itself — localhost is trusted automatically, no login needed there. To use it from your phone or another device on the LAN, open `http://localhost:44558/pair` on the PC and scan the QR code; the phone gets an auth cookie automatically and you can grant it specific permissions (or leave it view-only) from Settings → Devices.

## 3. Install the external tools you want to use

Nothing is required — each integration is independent and simply won't do anything until configured. Pick whichever you actually use:

| Feature | Tool | Where to configure |
|---|---|---|
| Fan profiles | FanControl | Settings → Tool Paths |
| Framerate limiting per game | RivaTuner Statistics Server | Settings → Tool Paths |
| CPU affinity control | Process Lasso | Settings → Tool Paths |
| Hardware sensors (temps/power/fan RPM) | LibreHardwareMonitor + PawnIO driver | Settings → Performance Monitoring |
| In-game FPS/frametime capture | PresentMon | auto-detected, or set manually in Settings → Performance Monitoring |

See [docs/windows-dependencies.md](docs/windows-dependencies.md) for install links, exact paths, and setup notes (e.g. LHM needs to run elevated with its web server enabled on port 8085; Process Lasso needs to have run at least once to create its config file).

Each tool-path field in Settings has a "test" button — use it to confirm the app can actually reach the tool before moving on.

## 4. Add your first Action

An Action is a sequence of steps — launch a program, send a hotkey, type text, wait, or switch display/audio/fan — triggered in one tap. A single Action can chain all of these together (e.g. switch display + audio + fan, wait, then launch a game).

1. If you're using display switching: go to Output → Display, arrange your monitors the way you want, then use "Capture" to save that live layout as a profile — the app captures your current setup directly via the Windows display API, you don't hand-author one.
2. If you're using audio switching: go to Settings → Audio Devices and add an entry for each physical device you want to target (a friendly name + a substring that matches the device name reported by Windows).
3. Go to the Actions section, click add, and add whichever steps you want — display / audio / fan / launch / hotkey / keysequence / text / delay — in the order they should run. None are required; use only what's relevant.

## 5. Add a Service (optional)

If you want to start/stop a Windows service or scheduled task from the dashboard (game streaming service, a media server, anything running as a service or task), go to Settings → Services, add it by its exact Windows service or task name, and enable control for it.

## Notes

- All configuration lives in `%LOCALAPPDATA%\HandyMon\config.json` — Windows convention for machine-specific app data, not the roaming `%APPDATA%` profile (this config describes *this* PC's hardware/tool paths, so it shouldn't follow a roaming profile to a different machine anyway).
- Paired devices and their permission grants live in the same directory.
- If you ever need to start over, stop the app and delete that folder — it'll be regenerated blank on next start.

## Migrating an existing install

Nothing migrates automatically between config locations — if you skip either step below, the app just starts blank (a fresh install) rather than erroring, and your old data stays untouched at the old path in case you want to go back.

**From `%USERPROFILE%\.handymon\` (pre-`%LOCALAPPDATA%` move)**: earlier builds stored everything directly in the profile root (a Unix-dotfile convention, not really a Windows one). To bring existing data forward:

1. Stop the app (`npm run stop-service`, or quit via the tray icon).
2. Copy (don't just rename, until you've confirmed the new location works) `%USERPROFILE%\.handymon\` to `%LOCALAPPDATA%\HandyMon\`.
3. Start the app again. It should come up with your existing Actions, Services, paired devices, and capture history intact.
4. Once you've verified the new location works, the old `%USERPROFILE%\.handymon\` folder can be deleted.

**From an even older pre-rename install** (`pc-control-web`): that config lived in `%USERPROFILE%\.pc-control-web\` — copy/rename it to `%USERPROFILE%\.handymon\` first, then follow the step above.
