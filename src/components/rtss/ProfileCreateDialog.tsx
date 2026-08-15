'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, CircularProgress } from '@mui/material';
import { useRtssProfiles } from '@/hooks/rtss/useRtssProfiles';
import { RtssApi } from '@/app/api/rtss/api';
import { ProcessNameAutocomplete } from '../ProcessSelector';
import { fieldStyle } from '@/components/ui/fieldStyle';
import { FormLabel } from '@/components/ui/FormLabel';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { DialogButtons } from '@/components/ui/DialogButtons';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (newName: string, copyFrom: string) => void;
};

export const ProfileCreateDialog = ({ open, onClose, onCreate }: Props) => {
  const [processName, setProcessName] = useState('');
  const [copyFrom, setCopyFrom] = useState('Global');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: profileData, isLoading } = useRtssProfiles();

  const handleSubmit = async () => {
    if (!processName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      // apiFetch throws on failure (incl. permission-denied), so reaching
      // here means it succeeded — no need to check an ok/error body shape.
      await RtssApi.profiles.copy(copyFrom, processName.trim());
      onCreate(processName.trim(), copyFrom);
      setProcessName('');
      setCopyFrom('Global');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  const valid = !!processName.trim() && !isSubmitting;

  return createPortal(
    <Box
      sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '16px' }}
      onClick={onClose}
    >
      <Box
        sx={{ width: '100%', maxWidth: 440, backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
        onClick={e => e.stopPropagation()}
      >
        <DialogHeader title="CREATE RTSS PROFILE" onClose={onClose} />

        {isLoading ? (
          <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={24} sx={{ color: 'var(--accent)' }} />
          </Box>
        ) : (<>
          <Box>
            <FormLabel>PROCESS NAME</FormLabel>
            <ProcessNameAutocomplete value={processName} onChange={setProcessName} placeholder="e.g. game.exe" />
          </Box>

          <Box>
            <FormLabel>COPY FROM</FormLabel>
            <select
              value={copyFrom}
              onChange={e => setCopyFrom(e.target.value)}
              style={fieldStyle}
            >
              {profileData?.profiles.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </Box>

          {error && (
            <Box sx={{ px: 1.25, py: 0.9, borderRadius: '7px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.78rem', color: 'var(--error)', lineHeight: 1.5 }}>
              {error}
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 0.5 }}>
            <Box
              onClick={onClose}
              sx={{ px: 2, py: 0.75, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.05em', '&:hover': { backgroundColor: 'var(--border)' } }}
            >
              CANCEL
            </Box>
            <Box
              onClick={valid ? handleSubmit : undefined}
              sx={{
                px: 2, py: 0.75, borderRadius: 7, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', gap: 1,
                backgroundColor: valid ? 'var(--accent)' : 'rgba(59,130,246,0.25)',
                color: valid ? 'white' : 'rgba(255,255,255,0.3)',
                cursor: valid ? 'pointer' : 'default',
              }}
            >
              {isSubmitting && <CircularProgress size={12} sx={{ color: 'inherit' }} />}
              CREATE
            </Box>
          </Box>
        </>)}
      </Box>
    </Box>,
    document.body
  );
};
