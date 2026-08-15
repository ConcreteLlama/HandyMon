import { FanControlApi } from "@/app/api/fan-control/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FAN_CONTROL_QUERY_KEY } from "./query-keys";

export const useSetFanProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (profileName: string) => FanControlApi.setActiveProfile(profileName),
        onSuccess: () => {
            return queryClient.invalidateQueries({ queryKey: [FAN_CONTROL_QUERY_KEY] });
        },
    })
}