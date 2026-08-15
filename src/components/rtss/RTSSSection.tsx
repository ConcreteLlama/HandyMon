'use client';

import { useEffect, useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, Switch, TextField,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { ServiceStatusIcon } from '@/components/ui/ServiceStatusIcon';
import { ServiceToggleButton } from '@/components/ui/ServiceToggleButton';
import DoneIcon from '@mui/icons-material/Done';
import ClearIcon from '@mui/icons-material/Clear';
import SpeedIcon from '@mui/icons-material/Speed';
import { RtssProfileSelector } from './ProfileSelector';
import { useActiveProfile } from '@/hooks/rtss/useActiveProfile';
import { useRtssConfig } from '@/hooks/rtss/useRtssConfig';
import { useUpdateRtssConfig } from '@/hooks/rtss/useUpdateRtssConfig';
import { useRtssInfo } from '@/hooks/rtss/useRtssInfo';
import { PartialRtssConfig } from '@/types/rtss';
import { apiFetch } from '@/utils/api-client';
import { showToast } from '@/components/ui/Toast';
import { helpProps } from '@/components/help/HelpModeContext';
import { HelpLink } from '@/components/ui/HelpLink';

const FPS_PRESETS = [30, 60, 90, 116, 120] as const;

const SectionLabel = ({ children, ...rest }: { children: React.ReactNode } & Record<string, unknown>) => (
  <Box
    {...rest}
    sx={{
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: '0.68rem',
      letterSpacing: '0.1em',
      color: 'var(--text-dim)',
      mb: 1,
    }}
  >
    {children}
  </Box>
);

export const RTSSSection = () => {
  const queryClient = useQueryClient();
  const [showPostApplyDialog, setShowPostApplyDialog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('Global');

  const { data, isLoading } = useQuery({
    queryKey: ['rtssStatus'],
    queryFn: () => apiFetch<{ running: boolean }>('/api/rtss/process'),
    refetchInterval: 10000,
  });

  const isRunning = data?.running ?? false;

  const toggleMutation = useMutation({
    mutationFn: () => apiFetch(`/api/rtss/process?action=${isRunning ? 'stop' : 'start'}`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rtssStatus'] }),
  });

  const activeProfile = useActiveProfile();
  const { data: rtssProfileConfig, refetch: refreshProfileConfig } = useRtssConfig(selectedProfile);
  const { data: activeProfileConfig, refetch: refreshActiveProfileConfig } = useRtssConfig(activeProfile?.name || 'Global');
  const [pendingFpsLimit, setPendingFpsLimit] = useState<number>(0);

  useEffect(() => {
    if (rtssProfileConfig) setPendingFpsLimit(rtssProfileConfig.Framerate.Limit);
  }, [rtssProfileConfig]);

  const { mutate: updateConfig, isPending: isConfigPending, isError: isConfigError } = useUpdateRtssConfig(selectedProfile);

  const handlePatchConfig = (config: PartialRtssConfig) => {
    if (!selectedProfile) return;
    updateConfig(config, {
      onSuccess: () => {
        setShowPostApplyDialog(true);
        queryClient.invalidateQueries({ queryKey: ['rtssStatus'] });
        refreshProfileConfig();
        refreshActiveProfileConfig();
      },
    });
  };

  const handleSetCap = (cap: number) => handlePatchConfig({ Framerate: { Limit: cap } });
  const handleSetEnableStats = (enabled: boolean) => handlePatchConfig({ OSD: { EnableStat: enabled ? 1 : 0 } });

  const statusColor = isLoading ? 'var(--warning)' : isRunning ? 'var(--success)' : 'var(--text-dim)';
  const statusLabel = isLoading ? 'CHECKING' : isRunning ? 'RUNNING' : 'STOPPED';

  const { available } = useRtssInfo();
  if (!available) {
    return (
      <Box sx={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px',
        p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, textAlign: 'center',
      }}>
        <SpeedIcon sx={{ fontSize: 28, color: 'var(--text-dim)', mb: 1 }} />
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--warning)' }}>
          RTSS not found
        </Box>
        <Box sx={{ fontSize: '0.72rem', color: 'var(--text-dim)', maxWidth: 340 }}>
          Set its install folder in Settings → Tool Paths — RivaTuner Statistics Server must be installed separately.
        </Box>
        <Box sx={{ mt: 0.5 }}><HelpLink anchor="rtss" /></Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        p: 3,
        borderBottom: '1px solid var(--border)',
      }}>
        <ServiceStatusIcon icon={SpeedIcon} isRunning={isRunning} statusColor={statusColor} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            {...helpProps('RTSS', "RivaTuner Statistics Server — a third-party tool this dashboard controls, not something HandyMon implements itself. It enforces the framerate cap and draws the in-game stats overlay. Must be installed separately.")}
            sx={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '1rem',
              letterSpacing: '0.05em',
            }}
          >
            RTSS
          </Box>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 0.25,
            flexWrap: 'wrap',
          }}>
            <Box sx={{ fontSize: '0.72rem', color: statusColor, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
              {statusLabel}
            </Box>
            {activeProfile && (
              <>
                <Box sx={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>·</Box>
                <Box sx={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {activeProfile.name}
                </Box>
              </>
            )}
            {activeProfileConfig && (
              <>
                <Box sx={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>·</Box>
                <Box sx={{ fontSize: '0.72rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                  {activeProfileConfig.Framerate.Limit === 0 ? 'UNCAPPED' : `${activeProfileConfig.Framerate.Limit} FPS`}
                </Box>
              </>
            )}
          </Box>
        </Box>

        <ServiceToggleButton
          isRunning={isRunning}
          isPending={toggleMutation.isPending}
          onToggle={() => toggleMutation.mutate()}
        />
      </Box>

      {/* Config body */}
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* Profile selector */}
        <Box>
          <SectionLabel {...helpProps('Profile', "RTSS applies different settings per-game via profiles. Global applies to anything without its own profile — pick a specific game's profile here to edit just that game's cap/overlay.")}>PROFILE</SectionLabel>
          <RtssProfileSelector onSelect={setSelectedProfile} />
        </Box>

        {/* FPS limit */}
        <Box>
          <SectionLabel {...helpProps('Framerate Limit', "Caps the selected profile's framerate at the OS/driver level via RTSS — 0 means uncapped. Changes only take effect once RTSS is (re)started, which the dialog after Apply offers to do for you.")}>FRAMERATE LIMIT</SectionLabel>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
            {FPS_PRESETS.map((fps) => (
              <Box
                key={fps}
                onClick={() => setPendingFpsLimit(fps)}
                sx={{
                  px: 1.5,
                  py: 0.6,
                  borderRadius: '6px',
                  border: `1px solid ${pendingFpsLimit === fps ? 'var(--accent)' : 'var(--border)'}`,
                  backgroundColor: pendingFpsLimit === fps ? 'var(--accent-dim)' : 'transparent',
                  color: pendingFpsLimit === fps ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  transition: 'all 0.12s ease',
                  '&:hover': {
                    borderColor: 'var(--border-hover)',
                    color: 'var(--text-primary)',
                  },
                }}
              >
                {fps}
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              type="number"
              value={pendingFpsLimit}
              onChange={(e) => setPendingFpsLimit(parseInt(e.target.value) || 0)}
              size="small"
              sx={{
                width: 90,
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: 'var(--bg-elevated)',
                  fontSize: '0.875rem',
                },
                '& input': { textAlign: 'center' },
              }}
              slotProps={{ htmlInput: { min: 0, max: 999 } }}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={isConfigPending ? <CircularProgress size={13} sx={{ color: 'white' }} /> : <DoneIcon />}
              onClick={() => handleSetCap(Number(pendingFpsLimit))}
              disabled={isConfigPending || pendingFpsLimit === rtssProfileConfig?.Framerate.Limit}
              sx={{
                backgroundColor: 'var(--accent)',
                '&:hover': { backgroundColor: 'rgba(59,130,246,0.85)' },
                '&.Mui-disabled': { backgroundColor: 'var(--border)', color: 'var(--text-dim)' },
              }}
            >
              Apply
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ClearIcon />}
              onClick={() => handleSetCap(0)}
              sx={{
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
                '&:hover': { borderColor: 'var(--border-hover)', backgroundColor: 'rgba(255,255,255,0.04)' },
              }}
            >
              Clear
            </Button>
          </Box>
        </Box>

        {/* OSD toggle */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1,
          px: 0,
          borderTop: '1px solid var(--border)',
        }}>
          <Box {...helpProps('Stats Overlay', "RTSS's own in-game overlay (framerate, frametime, hardware sensors) — separate from this app's own live FPS card. Toggling this changes the selected profile's config; RTSS needs a (re)start to pick it up, same as the framerate cap.")}>
            <Box sx={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
              Stats Overlay
            </Box>
            <Box sx={{ fontSize: '0.7rem', color: 'var(--text-dim)', mt: 0.2 }}>
              RTSS on-screen display
            </Box>
          </Box>
          <Switch
            checked={!!rtssProfileConfig?.OSD?.EnableStat}
            onChange={(e) => handleSetEnableStats(e.target.checked)}
          />
        </Box>

        {isConfigError && (
          <Box sx={{
            fontSize: '0.75rem',
            color: 'var(--error)',
            fontFamily: 'var(--font-mono)',
            p: 1.5,
            borderRadius: '8px',
            backgroundColor: 'var(--error-dim)',
            border: '1px solid rgba(248,113,113,0.2)',
          }}>
            Failed to update RTSS config
          </Box>
        )}
      </Box>

      {/* Post-apply dialog */}
      <Dialog
        open={showPostApplyDialog}
        onClose={() => setShowPostApplyDialog(false)}
      >
        <DialogTitle>Config Updated</DialogTitle>
        <DialogContent>
          <Box sx={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            The new framerate cap won&apos;t take effect until RTSS is {isRunning ? 'restarted' : 'started'}.
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPostApplyDialog(false)} sx={{ color: 'var(--text-secondary)' }}>
            Close
          </Button>
          <Button
            startIcon={isRunning ? <RestartAltIcon /> : <PlayArrowIcon />}
            onClick={async () => {
              try {
                await apiFetch(`/api/rtss/process?action=${isRunning ? 'restart' : 'start'}`, { method: 'POST' });
              } catch (e) {
                showToast(e instanceof Error ? e.message : 'Failed', 'error');
              } finally {
                setShowPostApplyDialog(false);
                queryClient.invalidateQueries({ queryKey: ['rtssStatus'] });
              }
            }}
            sx={{ color: 'var(--accent)' }}
          >
            {isRunning ? 'Restart RTSS' : 'Start RTSS'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
