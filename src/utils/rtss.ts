import { CONFIG } from "@/config";
import fs from 'fs';
import ini from 'ini';
import path from "path";
import { spawn } from "child_process";
import { listRunningProcessNames } from "./processes";
import { execCommand } from "./command";
import { PartialRtssConfig, RtssConfig, RtssConfigSchema, RtssProfile } from "@/types/rtss";
import _ from 'lodash';

export const RTSS_INSTALL_PATH = CONFIG.rtss.installPath;
export const RTSS_EXE = path.join(RTSS_INSTALL_PATH, 'RTSS.exe');
export const RTSS_PROFILES_PATH = path.join(RTSS_INSTALL_PATH, 'Profiles');

// Whether RTSS is actually installed at the configured path, so callers can
// show a clear "not found" state instead of letting listRtssProfiles() throw
// ENOENT — same pattern as Process Lasso's processLassoAvailable().
export const rtssAvailable = (): boolean => fs.existsSync(RTSS_PROFILES_PATH);

const makeProfileFilename = (profileName: string) => profileName === 'Global' ? 'Global' : `${profileName}.cfg`;

// Resolves a profile name to an absolute path inside RTSS_PROFILES_PATH, rejecting
// anything that would escape it. Profile names can come from user/remote input (a
// URL segment or the "copy to" destination query param) so this can't just trust
// path.join to keep the result inside the profiles directory.
const resolveProfilePath = (profileName: string): string => {
    const filename = makeProfileFilename(profileName);
    const resolved = path.join(RTSS_PROFILES_PATH, filename);
    if (path.basename(filename) !== filename || path.dirname(resolved) !== RTSS_PROFILES_PATH) {
        throw new Error(`Invalid profile name: ${profileName}`);
    }
    return resolved;
};

export const formatRtssTimestamp = (date: Date = new Date()): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1); // months are 0-based
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${day}-${month}-${year}, ${hours}:${minutes}:${seconds}`;
};

export const setRtssLimit = async (profileName: string, limit: number) => {
    const profile = await findRtssProfile(profileName);
    if (!profile) {
        throw new Error(`RTSS profile ${profile} does not exist`);
    }
    const profilePath = path.join(RTSS_PROFILES_PATH, profile.fileName);
    const iniContent = fs.readFileSync(profilePath, 'utf-8');
    const parsed = ini.parse(iniContent);

    if (!parsed.Framerate) parsed.Framerate = {};
    parsed.Framerate.Limit = limit;

    const newContent = ini.encode(parsed, { section: '' });

    fs.writeFileSync(profilePath, newContent, 'utf-8');
}

export const getRtssLimit = async (profileName: string) => {
    const config = await getRtssConfig(profileName);
    console.log('rtss config json is', config);
    const inified = ini.encode(config);
    console.log('rtss config ini is', inified);
    const limit = Number(config?.Framerate?.Limit ?? 0);
    return limit;
}

export const getRtssConfig = async (profileName: string) => {
    const profile = await findRtssProfile(profileName);
    if (!profile) {
        throw new Error(`RTSS profile ${profile} does not exist`);
    }
    const profilePath = path.join(RTSS_PROFILES_PATH, profile.fileName);
    const content = fs.readFileSync(profilePath, 'utf-8');
    const parsed = ini.parse(content);
    return RtssConfigSchema.parse(parsed);
}

export const setRtssConfig = async (profileName: string, config: RtssConfig) => {
    const profile = await findRtssProfile(profileName);
    const profilePath = profile
        ? path.join(RTSS_PROFILES_PATH, profile.fileName)
        : resolveProfilePath(profileName);
    config.Info.Timestamp = formatRtssTimestamp(new Date());
    const contents = ini.encode(config);
    fs.writeFileSync(profilePath, contents);
}

export const patchRtssConfig = async (profileName: string, config: PartialRtssConfig) => {
    const existingConfig = await getRtssConfig(profileName);
    const newConfig = _.merge(existingConfig, config);
    const validated = RtssConfigSchema.parse(newConfig);
    await setRtssConfig(profileName, validated);
    return validated;
}


export const GlobalProfile: RtssProfile = {
    name: 'Global',
    fileName: 'Global',
}
export const listRtssProfiles = async (): Promise<RtssProfile[]> => {
    const profilesDir = path.join(RTSS_INSTALL_PATH, 'Profiles');
    const files = await fs.promises.readdir(profilesDir);

    const profiles: RtssProfile[] = files
        .filter(file => file.endsWith('.cfg'))
        .map(file => ({
            name: path.basename(file, '.cfg'),
            fileName: file
        }));
    profiles.unshift((GlobalProfile));

    return profiles;
};

export const getActiveRtssProfile = async (profiles?: RtssProfile[]) => {
    profiles = profiles ? profiles : await listRtssProfiles();
    const activeProcesses = await listRunningProcessNames();
    const activeProfile = matchRunningProfile(profiles, activeProcesses);
    return activeProfile || GlobalProfile;
}

export const copyRtssProfile = async (from: string, to: string) => {
    const profiles = await listRtssProfiles();
    const fromProfile = await findRtssProfile(from, profiles);
    if (!fromProfile) {
        throw new Error(`From profile ${from} does not exist`);
    }
    fs.copyFileSync(path.join(RTSS_PROFILES_PATH, fromProfile.fileName), resolveProfilePath(to));
}

export const findRtssProfile = async (profileName: string, profiles?: RtssProfile[]): Promise<RtssProfile | null> => {
    profiles = profiles || await listRtssProfiles();
    return profiles.find((profile) => profile.name === profileName) || null;
}

export const matchRunningProfile = (profiles: RtssProfile[], running: string[]): RtssProfile | null => {
    const active = profiles.find(profile =>
        running.some(proc => `${proc}.exe`.toLowerCase() === profile.name.toLowerCase())
    );
    return active || null;
};

// RTSS is launched/killed directly rather than via a scheduled task — unlike
// the generic Services feature (arbitrary user-configured services/tasks),
// there's no external task for RTSS to hook into unless the user created one
// themselves, and HandyMon's own process already runs elevated (the "HandyMon"
// scheduled task runs HighestAvailable), so there's no privilege gap a
// scheduled task would have solved. Process name (not RTSS_EXE's basename)
// is used for the running-check since that's what Get-Process reports.
const RTSS_PROCESS_NAME = 'RTSS';

const isRtssRunning = async (): Promise<boolean> => {
    const running = await listRunningProcessNames();
    return running.some(name => name.toLowerCase() === RTSS_PROCESS_NAME.toLowerCase());
};

const waitForRtssState = async (
    toBe: 'started' | 'stopped',
    waitTime: number,
    checkInterval: number = 400,
): Promise<boolean> => {
    const startTime = Date.now();
    while (Date.now() - startTime < waitTime) {
        const running = await isRtssRunning();
        if (toBe === 'started' ? running : !running) return running;
        await new Promise((res) => setTimeout(res, checkInterval));
    }
    return isRtssRunning();
};

export const RtssService = {
    start: async (waitForStart: number = 0) => {
        const child = spawn(RTSS_EXE, [], { detached: true, stdio: 'ignore', shell: false });
        child.unref();
        const running = waitForStart > 0 ? await waitForRtssState('started', waitForStart) : undefined;
        return { startCommandOutput: 'RTSS.exe launched', running };
    },
    stop: async (waitForStop: number = 0) => {
        const result = await execCommand(
            `powershell -NoProfile -Command "Stop-Process -Name '${RTSS_PROCESS_NAME}' -Force -ErrorAction SilentlyContinue"`
        );
        const running = waitForStop > 0 ? await waitForRtssState('stopped', waitForStop) : undefined;
        return { startCommandOutput: result, running };
    },
    restart: async (delay: number = 2000) => {
        const stopResult = await RtssService.stop();
        await new Promise((resolve) => setTimeout(resolve, delay));
        const startResult = await RtssService.start();
        return { stopResult, startResult };
    },
    isRunning: isRtssRunning,
};