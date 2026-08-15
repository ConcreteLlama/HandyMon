'use client';

import { useEffect, useState } from 'react';
import { Box, Select, MenuItem, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useRtssProfiles } from '@/hooks/rtss/useRtssProfiles';
import { ProfileCreateDialog } from './ProfileCreateDialog';

type Props = {
  onSelect: (profileName: string) => void;
};

export const RtssProfileSelector = ({ onSelect }: Props) => {
  const { data, isLoading, refetch } = useRtssProfiles();
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const activeProfile = data?.activeProfile;

  const handleSelect = (profile: string) => {
    setSelectedProfile(profile);
    onSelect(profile);
  };

  useEffect(() => {
    if (activeProfile) handleSelect(activeProfile.name);
  }, [activeProfile]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Select
        value={selectedProfile}
        onChange={(e) => handleSelect(e.target.value)}
        size="small"
        fullWidth
        disabled={isLoading}
        sx={{ backgroundColor: 'var(--bg-elevated)' }}
      >
        {data?.profiles.map((profile) => (
          <MenuItem key={profile.name} value={profile.name}>
            {profile.name}
          </MenuItem>
        ))}
      </Select>
      <IconButton
        onClick={() => setDialogOpen(true)}
        size="small"
        sx={{
          color: 'var(--text-dim)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          p: 0.75,
          '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--accent-dim)' },
        }}
        title="Create new profile"
      >
        <AddIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <ProfileCreateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={() => { setDialogOpen(false); refetch(); }}
      />
    </Box>
  );
};
