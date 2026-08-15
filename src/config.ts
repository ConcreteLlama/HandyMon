import { getAppConfig } from './utils/app-config';

export const CONFIG = {
    get rtss() { return { installPath: getAppConfig().rtssInstallPath }; },
    get processLasso() { return { configPath: getAppConfig().processLassoConfigPath }; },
};