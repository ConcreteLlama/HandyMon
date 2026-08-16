#!/usr/bin/env node
// Builds the Windows installer: `next build` (output: 'standalone') -> stage
// a trimmed node_modules + the running node.exe -> compile via NSIS -> copy
// the finished installer into ./dist/.
//
// Staging happens OUTSIDE this repo (BUILD_DIR below) because this repo
// lives inside a NextCloud-synced folder, and rapid multi-file extraction/
// rename operations there are prone to transient EPERM locks from the sync
// client — see memory/docs (the electron-builder EPERM saga this replaced).
// BUILD_DIR is also deliberately short/top-level (not nested under a deep
// temp path) to avoid Windows MAX_PATH (260 char) failures in `File /r`.
//
// See docs/startup.md#packaged--installed-build for the full explanation of
// each trimming step below (why webpack gets patched back in, why
// swc/sharp/typescript/caniuse-lite get deleted, etc.) — kept brief here.

const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const BUILD_DIR = process.env.HANDYMON_BUILD_DIR || 'C:\\HandyMon-build';
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const { version } = require(path.join(REPO_ROOT, 'package.json'));

// Set by dev-build.yml (workflow_dispatch) to a short commit SHA — labels the
// installer as a dev build everywhere a user would see it (filename, window
// title, Add/Remove Programs entry) without forking the install location,
// registry key, or scheduled task name, so each new dev build still cleanly
// overwrites the last one in place rather than piling up separate installs.
// Unset for a real release build (release.yml, or plain local `npm run
// package:win`), which behaves exactly as before.
const DEV_BUILD_LABEL = process.env.HANDYMON_DEV_BUILD_LABEL || '';
const displayVersion = DEV_BUILD_LABEL ? `dev-${DEV_BUILD_LABEL}` : version;
const devSuffix = DEV_BUILD_LABEL ? ` (DEV BUILD ${DEV_BUILD_LABEL})` : '';

// Optional bundled tools (LibreHardwareMonitor + PawnIO, PresentMon) — staged
// OUTSIDE BUILD_DIR so the installer's main `File /r "${STAGE_DIR}\*.*"` never
// picks them up; the NSIS components page copies from here itself, only when
// the corresponding checkbox is selected. See docs/windows-dependencies.md
// for why each is bundled and the licensing basis (all MIT/MPL2/GPL2 —
// redistributable as separate binaries; see git history for the research).
const OPTIONAL_DIR = process.env.HANDYMON_OPTIONAL_DIR || 'C:\\HandyMon-build-optional';
// Not wiped between runs (unlike BUILD_DIR) — these are large, immutable,
// version-pinned downloads; re-fetching them on every `npm run package:win`
// during iteration would be slow for no benefit.
const CACHE_DIR = process.env.HANDYMON_PACKAGE_CACHE || 'C:\\HandyMon-package-cache';

// Pinned versions, not "latest" — matters most for PresentMon: bump this only
// after confirming --v1_metrics/--output_stdout still parses on the new
// release (see pmCompatible()'s comment in src/utils/presentmon.ts) and after
// bumping that function's version ceiling to match. v2.5.1 is the newest
// release confirmed working as of 2026-08-09 — it already reports
// msBetweenDisplayChange (DLSS4 flip-metering) under --v1_metrics, so the
// NVIDIA-patched fork RTSS bundles is no longer the only source of that.
const PRESENTMON_URL = 'https://github.com/GameTechDev/PresentMon/releases/download/v2.5.1/PresentMon-2.5.1-x64.exe';
const LHM_ZIP_URL = 'https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases/download/v0.9.6/LibreHardwareMonitor.zip';
const PAWNIO_URL = 'https://github.com/namazso/PawnIO.Setup/releases/download/2.2.0/PawnIO_setup.exe';
// Deliberately not LHM's own default (8085) — a bundled, auto-launched copy
// needs its own port so it doesn't collide with a separate LHM instance the
// user might already run themselves. See LibreHardwareMonitor.config below.
const LHM_BUNDLED_PORT = 8286;

function log(msg) { console.log(`[package-win] ${msg}`); }

process.on('exit', code => log(`process exiting with code ${code}`));
process.on('uncaughtException', err => { console.error('[package-win] uncaughtException:', err); process.exit(1); });
process.on('unhandledRejection', err => { console.error('[package-win] unhandledRejection:', err); process.exit(1); });

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

// https.get doesn't follow redirects itself, and GitHub release assets
// always 302 to objects.githubusercontent.com — follow manually, capped so a
// misbehaving redirect chain can't loop forever.
function downloadFile(url, destPath, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'HandyMon-package-win' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) { reject(new Error(`too many redirects fetching ${url}`)); return; }
        downloadFile(res.headers.location, destPath, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`GET ${url} -> ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadCached(url, cacheFileName) {
  const dest = path.join(CACHE_DIR, cacheFileName);
  if (fs.existsSync(dest)) {
    log(`  using cached ${cacheFileName}`);
    return dest;
  }
  log(`  downloading ${cacheFileName}...`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = dest + '.part';
  await downloadFile(url, tmp);
  fs.renameSync(tmp, dest);
  return dest;
}

// LibreHardwareMonitor's own settings file format — plain .NET appSettings
// XML, confirmed against PersistentSettings.cs (LibreHardwareMonitor.Windows.
// Forms/Utilities/PersistentSettings.cs) rather than guessed: <add key=.../>
// pairs, bool as literal "true"/"false". Pre-writing this next to the
// bundled exe means it comes up with its web server already enabled and
// minimized to tray — no first-run "enable Options -> Remote Web Server"
// step needed, which is the whole point of bundling it. Confirmed against
// UserOption.cs too: its Changed event fires once immediately on subscribe
// with the *loaded* value, which is what makes MainForm.cs's `if
// (_runWebServer.Value) Server.StartHttpListener()` actually run on startup
// from a pre-set config, not just on a later manual toggle.
function lhmConfigXml(port) {
  return `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <appSettings>
    <add key="runWebServerMenuItem" value="true" />
    <add key="listenerPort" value="${port}" />
    <add key="authenticationEnabled" value="false" />
    <add key="startMinMenuItem" value="true" />
  </appSettings>
</configuration>
`;
}

function stageBundledTools() {
  log('Staging optional bundled tools (PresentMon, LibreHardwareMonitor, PawnIO)...');
  rmrf(OPTIONAL_DIR);
  fs.mkdirSync(OPTIONAL_DIR, { recursive: true });

  return (async () => {
    // PresentMon — single exe, no extraction needed. Renamed to a plain
    // name; src/utils/presentmon.ts's presentMonExesIn() matches any
    // presentmon*.exe case-insensitively.
    const presentMonSrc = await downloadCached(PRESENTMON_URL, 'PresentMon-2.5.1-x64.exe');
    const presentMonDir = path.join(OPTIONAL_DIR, 'presentmon');
    fs.mkdirSync(presentMonDir, { recursive: true });
    fs.copyFileSync(presentMonSrc, path.join(presentMonDir, 'PresentMon.exe'));

    // LibreHardwareMonitor — zip, extract via PowerShell (no zip-handling
    // dependency in package.json otherwise), then drop our config in.
    const lhmZip = await downloadCached(LHM_ZIP_URL, 'LibreHardwareMonitor.zip');
    const lhmDir = path.join(OPTIONAL_DIR, 'LibreHardwareMonitor');
    fs.mkdirSync(lhmDir, { recursive: true });
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -Path '${lhmZip}' -DestinationPath '${lhmDir}' -Force`,
    ], { stdio: 'inherit' });
    // The zip's top-level layout varies by release (sometimes a single
    // nested folder, sometimes flat) — flatten one level if LibreHardware
    // Monitor.exe isn't directly at the root after extraction.
    if (!fs.existsSync(path.join(lhmDir, 'LibreHardwareMonitor.exe'))) {
      const nested = fs.readdirSync(lhmDir).find(f => fs.statSync(path.join(lhmDir, f)).isDirectory());
      if (nested) {
        const nestedDir = path.join(lhmDir, nested);
        for (const f of fs.readdirSync(nestedDir)) fs.renameSync(path.join(nestedDir, f), path.join(lhmDir, f));
        rmrf(nestedDir);
      }
    }
    if (!fs.existsSync(path.join(lhmDir, 'LibreHardwareMonitor.exe'))) {
      throw new Error(`LibreHardwareMonitor.exe not found in extracted zip — release layout may have changed, check ${lhmDir}`);
    }
    fs.writeFileSync(path.join(lhmDir, 'LibreHardwareMonitor.config'), lhmConfigXml(LHM_BUNDLED_PORT));

    // PawnIO — installer exe, run (silently, from the NSIS script) rather
    // than extracted; it installs a signed kernel driver.
    const pawnioSrc = await downloadCached(PAWNIO_URL, 'PawnIO_setup.exe');
    const pawnioDir = path.join(OPTIONAL_DIR, 'pawnio');
    fs.mkdirSync(pawnioDir, { recursive: true });
    fs.copyFileSync(pawnioSrc, path.join(pawnioDir, 'PawnIO_setup.exe'));

    log('  bundled tools staged.');
  })();
}

// fs.cpSync silently dies partway through a large recursive copy in this
// environment (repro'd in isolation — no thrown error, no exit handler
// fires, the process just gets killed outright), likely something about
// bulk-copying out of the NextCloud-synced repo tripping a sync-client lock
// or an external watchdog. robocopy is the battle-tested Windows tool for
// exactly this and doesn't have the issue.
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  // A genuinely empty directory (e.g. public/, which this app doesn't put
  // anything in) isn't tracked by git at all, so it simply doesn't exist
  // after a fresh clone — confirmed the hard way via the first CI run on a
  // clean checkout, after `public/` had quietly sat empty-but-present on
  // every dev machine that had ever run the app locally. Nothing to copy in
  // that case; the mkdir above already created the (empty) destination.
  if (!fs.existsSync(src)) return;
  // robocopy's exit codes are a bitmask where 0-7 all mean success (1 =
  // files copied, 2 = extra files in dest, etc.) — only 8+ is a real
  // failure. execFileSync throws on any non-zero code, so check manually.
  const result = require('child_process').spawnSync('robocopy', [src, dest, '/E', '/NFL', '/NDL', '/NJH', '/NJS'], { stdio: 'inherit' });
  if (result.status >= 8) {
    throw new Error(`robocopy failed copying ${src} -> ${dest} (exit code ${result.status})`);
  }
}

function findMakensis() {
  // 1. On PATH (e.g. after `winget install NSIS.NSIS`)
  try {
    execFileSync('where', ['makensis.exe'], { stdio: 'pipe' });
    return 'makensis.exe';
  } catch {}

  // 2. Standard NSIS install location (also where CI's cached install lands
  //    — see .github/workflows/*.yml's "Cache NSIS" step)
  const standard = 'C:\\Program Files (x86)\\NSIS\\makensis.exe';
  if (fs.existsSync(standard)) return standard;

  throw new Error(
    "makensis.exe not found. Install NSIS first: `winget install NSIS.NSIS`, " +
    "or set it up manually from https://nsis.sourceforge.io/."
  );
}

function stage() {
  // Force a genuinely clean compile — `next build` reuses .next/cache
  // (webpack's persistent cache) by default, and a stale hit there can ship
  // an installer with old compiled output despite current source (confirmed
  // live 2026-08-14: an installed build served pre-edit chart margin values
  // — chartSx/margin changes never took effect — even though `npx tsc
  // --noEmit` and a fresh `npm run dev` both showed the new code correctly).
  // This repo lives in a NextCloud-synced folder, which is a plausible way
  // for the cache's mtime/hash bookkeeping to get out of sync with reality;
  // rather than chase that, just remove the possibility every packaged build.
  rmrf(path.join(REPO_ROOT, '.next'));
  log('Running next build...');
  execSync('npm run build', { cwd: REPO_ROOT, stdio: 'inherit' });

  log(`Staging into ${BUILD_DIR}...`);
  log('  rmrf BUILD_DIR...');
  rmrf(BUILD_DIR);
  log('  copyDir .next/standalone -> BUILD_DIR...');
  copyDir(path.join(REPO_ROOT, '.next', 'standalone'), BUILD_DIR);
  log('  copyDir done, removing generated server.js...');
  fs.rmSync(path.join(BUILD_DIR, 'server.js'), { force: true }); // we use tray-main.js/server.js from the repo, not Next's generated one

  copyDir(path.join(REPO_ROOT, '.next', 'static'), path.join(BUILD_DIR, '.next', 'static'));
  copyDir(path.join(REPO_ROOT, 'public'), path.join(BUILD_DIR, 'public'));

  for (const f of ['tray-main.js', 'tray-native.js', 'server-guard.js', 'read-port.js', 'config-dir.js', 'launch-hidden.ps1', 'handymon.png', 'help.html']) {
    fs.copyFileSync(path.join(REPO_ROOT, f), path.join(BUILD_DIR, f));
  }

  // standalone's traced node_modules/next is missing next/dist/compiled/webpack
  // (and its own transitive deps) — our custom next({dev:false,dir}) API path
  // needs it even though Next's own generated (and now-deleted) server.js
  // doesn't. Swap in the full, untrimmed copy instead of chasing the missing
  // pieces one at a time.
  log('Replacing traced next/ with full copy (fixes missing webpack modules)...');
  rmrf(path.join(BUILD_DIR, 'node_modules', 'next'));
  copyDir(path.join(REPO_ROOT, 'node_modules', 'next'), path.join(BUILD_DIR, 'node_modules', 'next'));

  // Confirmed-unneeded at runtime for a pre-built app: SWC is Next's
  // build-time compiler (already ran during `next build` above), sharp/@img
  // back next/image which this app doesn't use, typescript/caniuse-lite are
  // build-time-only and get traced in regardless.
  log('Removing unused build-time-only packages...');
  for (const p of [
    ['node_modules', '@next', 'swc-win32-x64-msvc'],
    ['node_modules', '@img'],
    ['node_modules', 'sharp'],
    ['node_modules', 'typescript'],
    ['node_modules', 'caniuse-lite'],
  ]) {
    rmrf(path.join(BUILD_DIR, ...p));
  }

  const nodeExe = resolveNodeExe();
  log(`Copying node.exe (${nodeExe})...`);
  fs.copyFileSync(nodeExe, path.join(BUILD_DIR, 'node.exe'));
}

// Bundling whatever Node happens to be running this script is fine for fast
// local iteration, but wrong for an actual release — the dev machine's
// active nvm version may not be current LTS (or may even be EOL). Set
// HANDYMON_NODE_EXE to a specific node.exe (e.g. an nvm-managed LTS install
// under %LOCALAPPDATA%\nvm\v<version>\node.exe) when cutting a real release;
// falls back to whatever's currently running this script otherwise.
function resolveNodeExe() {
  if (process.env.HANDYMON_NODE_EXE) {
    if (!fs.existsSync(process.env.HANDYMON_NODE_EXE)) {
      throw new Error(`HANDYMON_NODE_EXE is set but doesn't exist: ${process.env.HANDYMON_NODE_EXE}`);
    }
    return process.env.HANDYMON_NODE_EXE;
  }
  return process.execPath;
}

function buildNsiScript() {
  const outFile = path.join(DIST_DIR, `HandyMon-Setup-${displayVersion}.exe`);
  return `
!define APP_NAME "HandyMon"
!define APP_VERSION "${displayVersion}"
!define APP_DEV_SUFFIX "${devSuffix}"
!define STAGE_DIR "${BUILD_DIR}"
!define OPTIONAL_DIR "${OPTIONAL_DIR}"
!define LHM_PORT "${LHM_BUNDLED_PORT}"

Name "\${APP_NAME}\${APP_DEV_SUFFIX}"
OutFile "${outFile}"
InstallDir "$PROGRAMFILES64\\\${APP_NAME}"
RequestExecutionLevel admin

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "TextFunc.nsh"
!include "Sections.nsh"
!insertmacro TrimNewLines

Var PortTextBox
Var PortValue
Var OldPortValue

!define MUI_ABORTWARNING
; HandyMon itself is already running by the time this page shows — the
; "-StartApp" section starts it unconditionally during the visible InstFiles
; progress (see its own comment for why), it's not gated on this checkbox.
; All LaunchApp actually does now is open a browser tab to it, so the label
; says that rather than "Launch HandyMon now", which read as if starting was
; still pending here (flagged live 2026-08-14 — the checkbox showing up
; *after* the progress bar had already waited for startup was confusing).
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Open the HandyMon dashboard now"
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!define MUI_COMPONENTSPAGE_SMALLDESC
!insertmacro MUI_PAGE_COMPONENTS
Page custom PortPage PortPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; The section-flag helper below (MaybeWriteLhmPort) references \${SecLHM} —
; NSIS resolves section-index constants in a single top-to-bottom pass, so it
; must appear (further down this generated script) AFTER the
; "Section ... SecLHM ... SectionEnd" block that defines it.

; Advanced page: lets the port be changed from the default 44558. Pre-fills
; with whatever's already in config.json (if this is a reinstall/update) so
; re-running the installer doesn't silently revert a previously-customized
; port back to the default.
Function PortPage
  !insertmacro MUI_HEADER_TEXT "Advanced Options" "Choose the port HandyMon's dashboard runs on"
  InitPluginsDir

  FileOpen $1 "$PLUGINSDIR\\read-port.ps1" w
  FileWrite $1 '$$p = 44558$\\r$\\n'
  FileWrite $1 'try { $$c = Get-Content "$$env:LOCALAPPDATA\\HandyMon\\config.json" -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json; if ($$c.port) { $$p = $$c.port } } catch {}$\\r$\\n'
  FileWrite $1 'Write-Output $$p$\\r$\\n'
  FileClose $1
  nsExec::ExecToStack 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\\read-port.ps1"'
  Pop $0
  Pop $PortValue
  \${TrimNewLines} "$PortValue" $PortValue
  StrCpy $OldPortValue $PortValue

  nsDialogs::Create 1018
  Pop $0
  \${If} $0 == error
    Abort
  \${EndIf}

  \${NSD_CreateLabel} 0 0 100% 32u "HandyMon's local web dashboard runs on this port (default 44558). Only change this if it conflicts with something else already using it — most people can leave this as-is."
  Pop $0

  \${NSD_CreateText} 0 40u 60u 13u "$PortValue"
  Pop $PortTextBox

  nsDialogs::Show
FunctionEnd

Function PortPageLeave
  \${NSD_GetText} $PortTextBox $PortValue
  \${If} $PortValue == ""
    StrCpy $PortValue "44558"
  \${EndIf}
FunctionEnd

; Stop any already-running instance — needed both before a (re)install
; overwrites files (node.exe is the actual running binary, and Windows won't
; let File /r overwrite it while in use) and on uninstall (previously
; missing entirely here — schtasks /delete only removes the task
; *definition*, it doesn't stop an already-running instance, confirmed live
; 2026-08-16: uninstalling left node.exe running and still listening on its
; port). Self-contained (reads the current port fresh from config.json
; rather than depending on a caller-populated variable) so it's safe to call
; from both contexts. schtasks /end should take the whole process tree down
; via its Job Object, but launch-hidden.ps1's Start-Process child can escape
; that tracking (observed in practice, not just theoretical) and keep
; running/listening even after schtasks reports success. Two fallbacks: (1)
; kill whatever's actually LISTENING on the configured port — the most
; reliable signal since it doesn't depend on WMI being able to report
; ExecutablePath for another elevated process (it often can't, even from an
; elevated caller); (2) the CIM exe-path match as a second net for anything
; not yet bound to a port. Both are harmless no-ops if nothing's running.
;
; NSIS compiles the installer and uninstaller as two separate binaries from
; this one script, and a plain Call only resolves within the binary its
; target Function was defined for — an uninstaller Section can only Call an
; "un."-prefixed Function (confirmed via a real makensis compile error:
; "Call must be used with function names starting with 'un.' in the
; uninstall section", caught in local verification before this ever shipped
; in a build). !macro/!insertmacro shares the body between both without
; duplicating it.
!macro StopRunningInstanceImpl
  DetailPrint "Stopping any running HandyMon instance..."
  nsExec::ExecToLog 'schtasks /end /tn "HandyMon"'
  InitPluginsDir
  FileOpen $1 "$PLUGINSDIR\\stop-existing.ps1" w
  FileWrite $1 '$$port = 44558$\\r$\\n'
  FileWrite $1 'try { $$c = Get-Content "$$env:LOCALAPPDATA\\HandyMon\\config.json" -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json; if ($$c.port) { $$port = $$c.port } } catch {}$\\r$\\n'
  FileWrite $1 'Get-NetTCPConnection -State Listen -LocalPort $$port -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $$_.OwningProcess -Force -ErrorAction SilentlyContinue }$\\r$\\n'
  FileWrite $1 'Get-CimInstance Win32_Process | Where-Object { $$_.Name -eq "node.exe" -and $$_.ExecutablePath -eq "$INSTDIR\\node.exe" } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }$\\r$\\n'
  FileClose $1
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\\stop-existing.ps1"'
  Sleep 1000
!macroend

Function StopRunningInstance
  !insertmacro StopRunningInstanceImpl
FunctionEnd

Function un.StopRunningInstance
  !insertmacro StopRunningInstanceImpl
FunctionEnd

; Leading "-" hides this from the Components page and makes it mandatory —
; the core app itself, unlike the two bundled-tool sections below.
Section "-Core" SecCore
  InitPluginsDir

  MessageBox MB_YESNO|MB_ICONQUESTION "HandyMon needs to register a Windows Scheduled Task that runs elevated (administrator rights) at every login — this is what lets it switch displays, audio devices, and fan profiles, which Windows requires elevation for.$\\r$\\n$\\r$\\nContinue with installation?" IDYES +2
  Abort

  Call StopRunningInstance

  SetOutPath "$INSTDIR"
  File /r "\${STAGE_DIR}\\*.*"

  DetailPrint "Registering HandyMon scheduled task (elevated, runs at logon, no execution time limit)..."
  FileOpen $0 "$PLUGINSDIR\\register-task.ps1" w
  FileWrite $0 '$$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File \`"$INSTDIR\\launch-hidden.ps1\`"" -WorkingDirectory "$INSTDIR"$\\r$\\n'
  FileWrite $0 '$$trigger = New-ScheduledTaskTrigger -AtLogOn$\\r$\\n'
  FileWrite $0 '$$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero)$\\r$\\n'
  FileWrite $0 'Register-ScheduledTask -TaskName "HandyMon" -Action $$action -Trigger $$trigger -Settings $$settings -RunLevel Highest -Force$\\r$\\n'
  FileClose $0
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\\register-task.ps1"'

  DetailPrint "Setting dashboard port to $PortValue..."
  FileOpen $2 "$PLUGINSDIR\\set-port.ps1" w
  FileWrite $2 '$$configDir = "$$env:LOCALAPPDATA\\HandyMon"$\\r$\\n'
  FileWrite $2 'New-Item -ItemType Directory -Force -Path $$configDir | Out-Null$\\r$\\n'
  FileWrite $2 '$$configPath = "$$configDir\\config.json"$\\r$\\n'
  ; -Encoding UTF8 here is required, not cosmetic — Windows PowerShell 5.1's
  ; Get-Content defaults to the system codepage (not UTF-8) for a BOM-less
  ; file, which silently mangles any non-ASCII text (e.g. an emoji in a
  ; preset name) into mojibake that then gets written straight back to disk.
  FileWrite $2 '$$config = if (Test-Path $$configPath) { Get-Content $$configPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { New-Object PSObject }$\\r$\\n'
  FileWrite $2 '$$config | Add-Member -NotePropertyName port -NotePropertyValue $PortValue -Force$\\r$\\n'
  ; Records exactly what this install actually has — bundledLhm/
  ; bundledPresentMon are read back directly on a future reinstall/upgrade to
  ; default the Components page to what was selected last time (see .onInit
  ; below), no inference needed. lhmPort only gets touched when LHM was
  ; selected, so a skip-bundling install keeps the ecosystem-default 8085 (or
  ; whatever the user already had) untouched. Pulled out into a called
  ; Function (defined further down, after the Sec* declarations) purely so
  ; the \${SecLHM}/\${SecPresentMon} references are textually after their
  ; definitions — Call itself works regardless of file order, unlike \${SecX}
  ; symbol references.
  Call WriteBundledToolFlags
  ; Windows PowerShell 5.1's -Encoding UTF8 always writes a BOM, which
  ; Node's JSON.parse can't read — System.IO.File WriteAllText with an
  ; explicit no-BOM UTF8Encoding avoids that entirely.
  FileWrite $2 '$$json = $$config | ConvertTo-Json -Depth 10$\\r$\\n'
  FileWrite $2 '[System.IO.File]::WriteAllText($$configPath, $$json, (New-Object System.Text.UTF8Encoding($$false)))$\\r$\\n'
  FileClose $2
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\\set-port.ps1"'

  WriteUninstaller "$INSTDIR\\Uninstall.exe"

  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APP_NAME}" "DisplayName" "\${APP_NAME}\${APP_DEV_SUFFIX}"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APP_NAME}" "UninstallString" "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APP_NAME}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APP_NAME}" "DisplayVersion" "\${APP_VERSION}"
  WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APP_NAME}" "NoModify" 1
  WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APP_NAME}" "NoRepair" 1

  CreateDirectory "$SMPROGRAMS\\\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\\\${APP_NAME}\\Start HandyMon.lnk" "$SYSDIR\\schtasks.exe" '/run /tn "HandyMon"'
  CreateShortcut "$SMPROGRAMS\\\${APP_NAME}\\HandyMon Help.lnk" "$INSTDIR\\help.html"
  CreateShortcut "$SMPROGRAMS\\\${APP_NAME}\\Uninstall HandyMon.lnk" "$INSTDIR\\Uninstall.exe"

SectionEnd

Section "PresentMon (in-game FPS)" SecPresentMon
  DetailPrint "Installing bundled PresentMon..."
  SetOutPath "$INSTDIR\\presentmon"
  File /r "\${OPTIONAL_DIR}\\presentmon\\*.*"
SectionEnd

Section "LibreHardwareMonitor + PawnIO driver (hardware sensors)" SecLHM
  ; HandyMon auto-launches the bundled copy (see ensureBundledLhmRunning() in
  ; lhm-launch.ts) — on a reinstall/upgrade it's very likely already running,
  ; and File /r can't overwrite a locked exe. Same problem the Core section
  ; already solves for node.exe above, just never extended to this one.
  ; Poll rather than a blind fixed sleep — Stop-Process returning doesn't
  ; guarantee the OS has finished releasing the exe's file handles yet, and a
  ; DLL still mid-teardown fails File /r below with the same Abort/Retry/
  ; Ignore prompt this is trying to avoid (observed live 2026-08-14). Up to
  ; ~5s, then proceeds regardless — if a handle is still stuck at that point
  ; something unusual is holding it (AV, a separate non-bundled LHM instance)
  ; and no amount of extra waiting here would reliably fix it anyway.
  DetailPrint "Stopping any running bundled LibreHardwareMonitor..."
  nsExec::ExecToLog 'powershell -NoProfile -Command "Get-Process -Name LibreHardwareMonitor -ErrorAction SilentlyContinue | Stop-Process -Force; for ($$i = 0; $$i -lt 25; $$i++) { if (-not (Get-Process -Name LibreHardwareMonitor -ErrorAction SilentlyContinue)) { break }; Start-Sleep -Milliseconds 200 }"'

  DetailPrint "Installing bundled LibreHardwareMonitor..."
  SetOutPath "$INSTDIR\\LibreHardwareMonitor"
  File /r "\${OPTIONAL_DIR}\\LibreHardwareMonitor\\*.*"

  ; PawnIO installs a separate signed kernel driver (needed for CPU/
  ; motherboard sensor reads) — run its own installer silently rather than
  ; extracting/repackaging the driver ourselves. Deliberately never
  ; uninstalled by HandyMon's own uninstaller: other tools (FanControl, etc.)
  ; can depend on the same shared system driver, so removing HandyMon
  ; shouldn't pull it out from under them.
  DetailPrint "Installing PawnIO driver..."
  SetOutPath "$PLUGINSDIR"
  File "\${OPTIONAL_DIR}\\pawnio\\PawnIO_setup.exe"
  nsExec::ExecToLog '"$PLUGINSDIR\\PawnIO_setup.exe" -install -silent'
SectionEnd

; Deliberately its own trailing hidden section (always runs, not shown on the
; Components page) rather than the tail of "-Core" above — starting the app
; here auto-launches bundled LHM via ensureBundledLhmRunning() at server
; startup, and on a reinstall the OLD LibreHardwareMonitor.exe is still on
; disk at that point. Starting before SecLHM had a chance to stop+overwrite
; it raced the app's own auto-launch against SecLHM's File /r, intermittently
; leaving LHM's freshly-(re)launched DLLs locked when the overwrite attempt
; landed a moment later ("Error opening file for writing: ...Aga.Controls.dll",
; observed live 2026-08-14). Running this only after both optional sections
; guarantees every bundled file is already in its final state before anything
; can launch and lock it.
Section "-StartApp"
  ; Starting it here (not just on the Finish page) means install completing
  ; = the app is actually running, same as most installers for an always-on
  ; background app; it also puts the ~20s worst-case wait for the dashboard
  ; to come up while the InstFiles page's DetailPrint log is still visible,
  ; instead of during a silent Finish-page click with no progress shown at
  ; all (see WaitForDashboardReady's own comment for the full reasoning).
  DetailPrint "Starting HandyMon..."
  nsExec::ExecToLog 'schtasks /run /tn "HandyMon"'
  Call WaitForDashboardReady
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT \${SecPresentMon} "Bundles a known-compatible PresentMon build for in-game FPS/frametime capture — skip this if you already have CapFrameX, RTSS, or another PresentMon install you'd rather point HandyMon at manually in Settings."
  !insertmacro MUI_DESCRIPTION_TEXT \${SecLHM} "Bundles LibreHardwareMonitor (pre-configured, auto-starts with HandyMon) plus the PawnIO driver it needs for CPU/motherboard sensors — skip this if you already run LibreHardwareMonitor yourself."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; Both bundled-tool sections default checked (NSIS's own default for a plain
; Section) — a genuinely fresh install (no existing config.json at all) always
; stays checked; we don't try to detect a pre-existing *separate* LHM/
; PresentMon install by guessing at common paths, since an earlier version of
; this did exactly that (checking $PROGRAMFILES64\LibreHardwareMonitor\...)
; and misfired on a machine that had never had LHM installed at all — cause
; never pinned down even after checking the \${SECTION_OFF} idiom and jump
; offsets against NSIS's own Sections.nsh, so that approach was dropped
; rather than trusted further.
;
; What IS reliable: if config.json already exists, this is a reinstall/
; upgrade, not a first install — and WriteBundledToolFlags (below) writes
; bundledLhm/bundledPresentMon into it as a direct, deterministic record of
; what was actually selected, rather than us re-inferring it from indirect
; side effects (a port number happening to match, a file happening to exist,
; a process happening to be running — an earlier version of this checked a
; hardcoded LHM install path and misfired for a reason never pinned down; a
; later version compared lhmPort + a live process check, which worked but
; was still inference). On reinstall, just read the flags straight back.
Function .onInit
  IfFileExists "$LOCALAPPDATA\\HandyMon\\config.json" 0 defaults_done

    InitPluginsDir
    FileOpen $4 "$PLUGINSDIR\\read-bundled-flags.ps1" w
    ; Default true/true (not false/false): a config.json that predates
    ; bundledLhm/bundledPresentMon entirely (any install from before this
    ; installer tracked them) has neither key present at all — that's
    ; "unknown", not "explicitly declined". Treating unknown as false was the
    ; actual bug here: it silently unchecked both components on every
    ; upgrade from an older build, since the field being merely *absent*
    ; (not false) got read as [bool]$null -eq $false. Only an explicit
    ; false in the file (written by a modern installer whose Components
    ; page the user genuinely unchecked) should flip these to false.
    FileWrite $4 '$$lhm = $$true; $$pm = $$true$\\r$\\n'
    FileWrite $4 'try {$\\r$\\n'
    FileWrite $4 '  $$c = Get-Content "$LOCALAPPDATA\\HandyMon\\config.json" -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json$\\r$\\n'
    FileWrite $4 '  if ($$c.PSObject.Properties.Name -contains "bundledLhm") { $$lhm = [bool]$$c.bundledLhm }$\\r$\\n'
    FileWrite $4 '  if ($$c.PSObject.Properties.Name -contains "bundledPresentMon") { $$pm = [bool]$$c.bundledPresentMon }$\\r$\\n'
    FileWrite $4 '} catch {}$\\r$\\n'
    FileWrite $4 'Write-Output "$$lhm,$$pm"$\\r$\\n'
    FileClose $4
    nsExec::ExecToStack 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\\read-bundled-flags.ps1"'
    Pop $0
    Pop $5
    \${TrimNewLines} "$5" $5

    \${If} $5 != "True,True"
    \${AndIf} $5 != "True,False"
      SectionGetFlags \${SecLHM} $0
      IntOp $0 $0 & \${SECTION_OFF}
      SectionSetFlags \${SecLHM} $0
    \${EndIf}

    \${If} $5 != "True,True"
    \${AndIf} $5 != "False,True"
      SectionGetFlags \${SecPresentMon} $0
      IntOp $0 $0 & \${SECTION_OFF}
      SectionSetFlags \${SecPresentMon} $0
    \${EndIf}

  defaults_done:
FunctionEnd

; Called from the Core section (see above) — separated out only so its
; \${SecLHM}/\${SecPresentMon} references are textually after those sections'
; declarations. Writes a direct, deterministic record of what got selected —
; see the comment above .onInit for why this replaced inferring it later.
Function WriteBundledToolFlags
  SectionGetFlags \${SecLHM} $3
  IntOp $3 $3 & \${SF_SELECTED}
  \${If} $3 <> 0
    FileWrite $2 '$$config | Add-Member -NotePropertyName bundledLhm -NotePropertyValue $$true -Force$\\r$\\n'
    FileWrite $2 '$$config | Add-Member -NotePropertyName lhmPort -NotePropertyValue \${LHM_PORT} -Force$\\r$\\n'
  \${Else}
    FileWrite $2 '$$config | Add-Member -NotePropertyName bundledLhm -NotePropertyValue $$false -Force$\\r$\\n'
  \${EndIf}

  SectionGetFlags \${SecPresentMon} $3
  IntOp $3 $3 & \${SF_SELECTED}
  \${If} $3 <> 0
    FileWrite $2 '$$config | Add-Member -NotePropertyName bundledPresentMon -NotePropertyValue $$true -Force$\\r$\\n'
  \${Else}
    FileWrite $2 '$$config | Add-Member -NotePropertyName bundledPresentMon -NotePropertyValue $$false -Force$\\r$\\n'
  \${EndIf}
FunctionEnd

; Polls localhost:$PortValue (a raw TCP connect, not a full HTTP request —
; lighter, and doesn't care about redirects/auth) up to 20 times, 1s apart,
; for the dashboard actually being reachable — next({dev:false}).prepare()
; plus the tray handshake takes a few seconds, so opening the browser
; immediately after schtasks /run would frequently race a connection-refused
; page. Proceeds and opens anyway after ~20s even if it never came up, so a
; genuine startup problem is still visible (a real error page) rather than
; the launch silently doing nothing.
; Called twice: once from the end of the Core section below (while the
; InstFiles page's DetailPrint log is still visible, so the ~20s worst case
; reads as "actively doing something" instead of the installer looking
; frozen — the actual bug report this fixes) and again, defensively, from
; LaunchApp on the Finish page (near-instant no-op by then since the port's
; already up — cheap insurance against something unusual delaying readiness
; between the two phases, not the primary wait anymore). Hard 20s timeout
; (20 attempts, 1s apart): if the dashboard genuinely never comes up, this
; gives up and the browser opens anyway to a connection-refused page rather
; than hanging indefinitely with nothing to show for it.
Function WaitForDashboardReady
  DetailPrint "Waiting for the HandyMon dashboard to start..."
  StrCpy $6 0
  wait_loop:
    IntOp $6 $6 + 1
    InitPluginsDir
    FileOpen $7 "$PLUGINSDIR\\probe-port.ps1" w
    FileWrite $7 'try {$\\r$\\n'
    FileWrite $7 '  $$client = New-Object System.Net.Sockets.TcpClient$\\r$\\n'
    FileWrite $7 '  $$client.Connect("localhost", $PortValue)$\\r$\\n'
    FileWrite $7 '  $$client.Close()$\\r$\\n'
    FileWrite $7 '  Write-Output "READY"$\\r$\\n'
    FileWrite $7 '} catch {}$\\r$\\n'
    FileClose $7
    nsExec::ExecToStack 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\\probe-port.ps1"'
    Pop $0
    Pop $8
    \${TrimNewLines} "$8" $8
    \${If} $8 == "READY"
      DetailPrint "HandyMon dashboard is up."
      Return
    \${EndIf}
    IntCmp $6 20 wait_timeout 0 wait_timeout
    DetailPrint "Still waiting... ($6/20)"
    Sleep 1000
    Goto wait_loop
  wait_timeout:
    DetailPrint "Dashboard didn't respond within 20s — continuing anyway (check the tray icon)."
FunctionEnd

Function LaunchApp
  Call WaitForDashboardReady
  ExecShell "open" "http://localhost:$PortValue"
FunctionEnd

Section "Uninstall"
  ; schtasks /delete below only removes the task *definition* — it does NOT
  ; stop an already-running instance, so this has to happen first (confirmed
  ; live 2026-08-16: without it, uninstalling left node.exe running and still
  ; listening on its port, invisible in Task Manager's "HandyMon" grouping
  ; since the task itself was already gone).
  Call un.StopRunningInstance

  DetailPrint "Removing HandyMon scheduled task..."
  nsExec::ExecToLog 'schtasks /delete /tn "HandyMon" /f'

  ; Same reasoning as the reinstall-time stop in the LHM section above — if
  ; it's still running (likely, since it auto-launches with HandyMon and
  ; nothing else stops it), RMDir can't delete a locked exe.
  DetailPrint "Stopping bundled LibreHardwareMonitor if running..."
  nsExec::ExecToLog 'powershell -NoProfile -Command "Get-Process -Name LibreHardwareMonitor -ErrorAction SilentlyContinue | Stop-Process -Force"'
  Sleep 500

  RMDir /r "$SMPROGRAMS\\\${APP_NAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APP_NAME}"
SectionEnd
`.trim();
}

// Compiles every native-interop assembly (audio/display/native-worker/tray)
// directly into BUILD_DIR/native/, so the installer ships them precompiled
// instead of the app ever compiling anything at runtime in production —
// same scripts/compile-native.js used by the predev/prebuild npm hooks,
// just pointed at the staged build dir instead. Fails the whole packaging
// step loudly if any expected artifact doesn't show up — a silent gap here
// would ship an installer missing a native-interop feature with no runtime
// fallback to fall back on (the install directory needs admin to write to
// at all).
function precompileNativeInterop() {
  log('Precompiling native-interop assemblies...');
  execFileSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'compile-native.js'), '--out', path.join(BUILD_DIR, 'native')], { stdio: 'inherit' });

  const expected = ['audio-interop.dll', 'display-interop.dll', 'native-worker.exe', 'tray-interop.dll'];
  const missing = expected.filter(f => !fs.existsSync(path.join(BUILD_DIR, 'native', f)));
  if (missing.length) {
    throw new Error(`Native-interop precompile is missing: ${missing.join(', ')} — check the compile-native output above.`);
  }
  log('  all native-interop assemblies present.');
}

function compile() {
  const makensis = findMakensis();
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const nsiPath = path.join(BUILD_DIR, 'handymon-installer.nsi');
  fs.writeFileSync(nsiPath, buildNsiScript());

  log(`Compiling installer with ${makensis}...`);
  execFileSync(makensis, [nsiPath], { stdio: 'inherit' });

  log(`Done: dist/HandyMon-Setup-${displayVersion}.exe`);
}

(async () => {
  try {
    stage();
    await stageBundledTools();
    precompileNativeInterop();
    compile();
  } catch (err) {
    console.error('[package-win] FAILED:', err);
    process.exit(1);
  }
})();
