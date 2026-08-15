'use client';

import { useEffect, useState } from 'react';
import { Box, Select, MenuItem, Slider } from '@mui/material';
import HeadsetIcon from '@mui/icons-material/Headset';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeMuteIcon from '@mui/icons-material/VolumeMute';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useAudioDevices } from '@/hooks/audio-devices/useAudioDevices';
import { usePerformAudioDeviceAction } from '@/hooks/audio-devices/useSetAudioDevice';
import { useAppConfig, useUpdateAppConfig } from '@/hooks/config/useAppConfig';
import { AppConfig } from '@/types/app-config';
import { SoundDevicesSection } from '@/components/settings/SoundDevicesSection';
import { helpProps } from '@/components/help/HelpModeContext';

const VolumeIcon = ({ volume }: { volume: number }) => {
  if (volume === 0) return <VolumeMuteIcon sx={{ fontSize: 16, color: 'var(--text-dim)' }} />;
  if (volume < 50) return <VolumeDownIcon sx={{ fontSize: 16, color: 'var(--accent)' }} />;
  return <VolumeUpIcon sx={{ fontSize: 16, color: 'var(--accent)' }} />;
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    mb: 1.25,
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: '0.7rem',
    letterSpacing: '0.1em',
    color: 'var(--text-dim)',
  }}>
    {children}
  </Box>
);

export const AudioDeviceSelector = () => {
  const { data, isLoading } = useAudioDevices();
  const { mutate: performAction } = usePerformAudioDeviceAction();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(50);
  const [volumeLocked, setVolumeLocked] = useState(true);

  // Named devices (for Mode profile dropdowns) are config-authoring, gated by
  // settings:read/write like Services/CPU-set presets — shown here rather
  // than tucked in Settings since this is where you'd actually reach for it.
  // Devices without settings access just don't see this section at all.
  const { data: config } = useAppConfig();
  const { mutateAsync: updateConfig } = useUpdateAppConfig();
  const configLoaded = !!config && Array.isArray((config as AppConfig).services);

  useEffect(() => {
    if (data?.active) {
      setSelectedId(data.active.id);
      if (typeof data.active.volumePercent === 'number') {
        setVolume(data.active.volumePercent);
      }
    }
  }, [data]);

  const handleDeviceChange = (id: string) => {
    setSelectedId(id);
    performAction({ id, actions: [{ action: 'set-default', types: ['Multimedia'] }] });
  };

  const handleVolumeChange = (_: any, value: number | number[]) => {
    setVolume(typeof value === 'number' ? value : value[0]);
  };

  const handleVolumeCommit = (_: any, value: number | number[]) => {
    if (selectedId) {
      const vol = typeof value === 'number' ? value : value[0];
      performAction({ id: selectedId, actions: [{ action: 'set-volume', volume: vol }] });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
    <Box sx={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      p: 3,
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
    }}>
      {/* Device selector */}
      <Box>
        <Label>
          <HeadsetIcon sx={{ fontSize: 14 }} />
          OUTPUT DEVICE
        </Label>
        <Select
          fullWidth
          value={selectedId || ''}
          onChange={(e) => handleDeviceChange(e.target.value)}
          disabled={isLoading}
          size="small"
          displayEmpty
          sx={{
            backgroundColor: 'var(--bg-elevated)',
            '& .MuiSelect-select': { py: 1.4 },
          }}
        >
          {!selectedId && <MenuItem value="" disabled>Loading devices…</MenuItem>}
          {data?.available.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              <Box>
                <Box sx={{ fontSize: '0.875rem' }}>{d.name}</Box>
                <Box sx={{
                  fontSize: '0.68rem',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)',
                  mt: 0.1,
                }}>
                  {d.deviceName}
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Volume */}
      <Box>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.25,
        }}>
          <Label>
            <VolumeIcon volume={volume} />
            VOLUME
          </Label>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
            <Box sx={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.05rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              minWidth: 42,
              textAlign: 'right',
            }}>
              {volume}%
            </Box>
            <Box
              onClick={() => setVolumeLocked(v => !v)}
              {...helpProps('Volume lock', "Locked by default so an accidental slider touch (especially on a phone) can't blast the volume — tap the lock to unlock the slider before dragging it.")}
              sx={{
                cursor: 'pointer',
                color: volumeLocked ? 'var(--text-dim)' : 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                p: 0.5,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: volumeLocked ? 'var(--border)' : 'rgba(59,130,246,0.3)',
                backgroundColor: volumeLocked ? 'transparent' : 'var(--accent-dim)',
                transition: 'all 0.15s ease',
                '&:hover': { borderColor: 'var(--border-hover)', color: 'var(--text-primary)' },
              }}
            >
              {volumeLocked
                ? <LockIcon sx={{ fontSize: 14 }} />
                : <LockOpenIcon sx={{ fontSize: 14 }} />
              }
            </Box>
          </Box>
        </Box>

        <Slider
          value={volume}
          onChange={handleVolumeChange}
          onChangeCommitted={handleVolumeCommit}
          min={0}
          max={100}
          disabled={volumeLocked}
          sx={{ opacity: volumeLocked ? 0.45 : 1, transition: 'opacity 0.2s' }}
        />

        {volumeLocked && (
          <Box sx={{
            fontSize: '0.68rem',
            color: 'var(--text-dim)',
            mt: 0.75,
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
          }}>
            UNLOCK TO ADJUST
          </Box>
        )}
      </Box>
    </Box>

    {configLoaded && (
      <SoundDevicesSection config={config!} onSave={updateConfig} />
    )}
    </Box>
  );
};
