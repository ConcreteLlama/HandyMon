import { RtssProfile } from "@/types/rtss";
import { apiFetch } from "@/utils/api-client";

export const listRtssProfilesApi = () =>
  apiFetch<{ profiles: RtssProfile[]; activeProfile: RtssProfile }>(`/api/rtss/profiles`);