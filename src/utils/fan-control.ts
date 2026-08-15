import { execFile } from "child_process";
import { readFile, readdir } from "fs/promises";
import path from "path";
import { promisify } from "util";
import { TEMP_DIR } from "./dirs";
import { getAppConfig } from "./app-config";

const execFileAsync = promisify(execFile);

const getFanControlDir = () => getAppConfig().fanControlPath;
const getConfigPath = () => path.join(getFanControlDir(), 'Configurations');
const TEMP_ACTIVE_PROFILE_STORE = path.join(TEMP_DIR, 'active-fan-profile.json');

export const getActiveFanProfile = async (): Promise<string> => {
  const CACHE_FILE = path.join(getConfigPath(), 'CACHE');
  const [cacheStat, selectedStat] = await Promise.allSettled([
    readFile(CACHE_FILE, 'utf-8'),
    readFile(TEMP_ACTIVE_PROFILE_STORE, 'utf-8'),
  ]);

  const cache = cacheStat.status === 'fulfilled'
    ? JSON.parse(cacheStat.value)
    : null;

  const selected = selectedStat.status === 'fulfilled'
    ? JSON.parse(selectedStat.value)
    : null;

  if (!cache && !selected) throw new Error('No profile info available');

  // Choose the newer file
  const cacheTime = cache?.mtimeMs ?? 0;
  const selectedTime = selected?.mtimeMs ?? 0;

  return selectedTime >= cacheTime
    ? selected?.profile ?? cache?.CurrentConfigFileName
    : cache?.CurrentConfigFileName;
};

export const listFanProfiles = async (): Promise<string[]> => {
  const files = await readdir(getConfigPath());
  return files.filter((file) => file.endsWith('.json') && file !== 'CACHE');
};

import { writeFile } from 'fs/promises';

export const setFanProfile = async (profileFileName: string): Promise<void> => {
  if (!profileFileName.endsWith('.json')) {
    profileFileName = `${profileFileName}.json`;
  }
  const fanControlExe = path.join(getFanControlDir(), 'FanControl.exe');
  await execFileAsync(fanControlExe, ['--config', profileFileName]);
  await writeFile(
    TEMP_ACTIVE_PROFILE_STORE,
    JSON.stringify({ profile: profileFileName }),
    'utf-8'
  );
};

