import { RtssApi } from "@/app/api/rtss/api";
import { PartialRtssConfig } from "@/types/rtss";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RTSS_CONFIG_QUERY_KEY } from "./useRtssConfig";

export const useUpdateRtssConfig = (profile: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (config: PartialRtssConfig) => {
            return RtssApi.profiles.config.update(profile, config);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [RTSS_CONFIG_QUERY_KEY] }),
    })
};