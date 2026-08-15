import { RtssApi } from "@/app/api/rtss/api";
import { useQuery } from "@tanstack/react-query";

export const RTSS_CONFIG_QUERY_KEY = 'rtssConfig';

export const useRtssConfig = (profile: string) => useQuery({
    queryKey: [RTSS_CONFIG_QUERY_KEY, profile],
    queryFn: () => RtssApi.profiles.config.get(profile).then((result) => result.config)
});