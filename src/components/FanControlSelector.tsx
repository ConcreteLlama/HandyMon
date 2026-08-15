'use client';

import { Box, CircularProgress } from '@mui/material';
import AirIcon from '@mui/icons-material/Air';
import { useFanProfiles } from '@/hooks/fan-control/useFanProfiles';
import { useSetFanProfile } from '@/hooks/fan-control/useSetFanProfile';
import { SelectableCard } from '@/components/ui/SelectableCard';
import { HelpLink } from '@/components/ui/HelpLink';
import { useGrants } from '@/hooks/auth/useGrants';

export const FanControlSelector = () => {
  const { data, isLoading } = useFanProfiles();
  const mutation = useSetFanProfile();
  const { has } = useGrants();
  const canWrite = has('fans:write');

  const profiles = (data?.availableProfiles ?? []).map(p => p.replace(/\.json$/, ''));
  const activeProfile = (data?.activeProfile ?? '').replace(/\.json$/, '');

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress size={26} sx={{ color: 'var(--accent)' }} />
      </Box>
    );
  }

  if (data && !data.available) {
    return (
      <Box sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
        py: 4, px: 2, textAlign: 'center',
      }}>
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--warning)' }}>
          FanControl not found
        </Box>
        <Box sx={{ fontSize: '0.72rem', color: 'var(--text-dim)', maxWidth: 320 }}>
          Set its install folder in Settings → Tool Paths — it also needs to have been run at least once to create its profile cache.
        </Box>
        <Box sx={{ mt: 0.5 }}><HelpLink anchor="fancontrol" /></Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {profiles.map((profile) => {
        const isActive = activeProfile === profile;
        const isThisLoading = mutation.isPending && mutation.variables === profile;

        return (
          <SelectableCard
            key={profile}
            label={profile.toUpperCase()}
            icon={AirIcon}
            isActive={isActive}
            isLoading={isThisLoading}
            disabled={mutation.isPending}
            lockedReason={canWrite ? undefined : "You don't have permission to change fan profiles"}
            onClick={() => mutation.mutate(profile)}
          />
        );
      })}
    </Box>
  );
};
