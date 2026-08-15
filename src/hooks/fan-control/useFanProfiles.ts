import { FanControlApi } from "@/app/api/fan-control/api";
import { useQuery } from "@tanstack/react-query";
import { FAN_CONTROL_QUERY_KEY } from "./query-keys";
 
 export const useFanProfiles = () => useQuery({
    queryKey: [FAN_CONTROL_QUERY_KEY],
    queryFn: FanControlApi.get,
  });