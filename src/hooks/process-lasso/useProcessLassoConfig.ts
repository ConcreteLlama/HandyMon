import { useQuery } from '@tanstack/react-query';
import { ProcessLassoApi } from '@/app/api/process-lasso/api';

export const PROCESS_LASSO_CONFIG_KEY = ['process-lasso', 'config'];

// The full Process Lasso runtime config (currently just ProcessDefaults.CPUSets)
// — separate from the app's own processRulePresets blob (see useProcessRulePresets),
// this is Process Lasso's own native config file.
export function useProcessLassoConfig(enabled: boolean = true) {
  return useQuery({
    queryKey: PROCESS_LASSO_CONFIG_KEY,
    queryFn: () => ProcessLassoApi.config.get(),
    enabled,
  });
}
