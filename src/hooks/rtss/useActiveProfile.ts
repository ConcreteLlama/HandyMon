import { useRtssProfiles } from './useRtssProfiles';

export const useActiveProfile = () => {
    const profiles = useRtssProfiles();
    return profiles.data?.activeProfile;
}