import { getRtssConfigApiCall, patchRtssConfigApiCall, setRtssConfigApiCall } from "./profiles/[id]/config/api";
import { copyRtssProfileAPICall } from "./profiles/[id]/copy/api";
import { listRtssProfilesApi } from "./profiles/api";
import { apiFetch } from "@/utils/api-client";

export const RtssApi = {
    profiles: {
        config: {
            get: getRtssConfigApiCall,
            set: setRtssConfigApiCall,
            update:  patchRtssConfigApiCall,
        },
        copy: copyRtssProfileAPICall,
        list: listRtssProfilesApi
    },
    availability: () => apiFetch<{ available: boolean }>('/api/rtss/availability'),
}