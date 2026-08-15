'use client';

import { Box, CircularProgress } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useMyConnection } from '@/hooks/auth/useMyConnection';
import { GRANT_GROUPS } from '@/types/grants';
import { helpProps } from '@/components/help/HelpModeContext';

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'Just now';
  if (hours < 1) return `${mins}m ago`;
  if (days < 1) return `${hours}h ago`;
  return `${days}d ago`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ flex: '1 1 120px', minWidth: 0 }}>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)' }}>{label}</Box>
      <Box sx={{ fontSize: '0.78rem', color: 'var(--text-primary)', mt: 0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Box>
    </Box>
  );
}

// Shown to every device (unlike the rest of Settings, which is host-config
// editing) — this is "who am I / what can I do", relevant to the host and any
// paired remote device alike. Read-only.
export function MyConnectionSection() {
  const { data, isLoading } = useMyConnection();

  return (
    <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PersonIcon sx={{ fontSize: 18, color: 'var(--accent)' }} />
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
          MY CONNECTION
        </Box>
      </Box>

      {isLoading || !data ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={18} sx={{ color: 'var(--accent)' }} /></Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
            <Stat label="NAME" value={data.name} />
            <Stat label="CONNECTION" value={data.isLocalhost ? 'Host PC (full access)' : 'Remote device'} />
            <Stat label="IP ADDRESS" value={data.ip ?? 'Not reported'} />
            {!data.isLocalhost && <Stat label="PAIRED" value={timeAgo(data.pairedAt)} />}
            {!data.isLocalhost && <Stat label="LAST SEEN" value={timeAgo(data.lastSeen)} />}
          </Box>
          <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', mb: 2, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.userAgent}
          </Box>

          <Box
            {...helpProps('Permissions', "What THIS device is currently allowed to do — a green check means this device has that grant. The host PC (viewing from localhost) always has every grant regardless of what's shown here. Edit a remote device's grants from Paired Devices below → tap the device.")}
            sx={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)', mb: 1 }}
          >
            PERMISSIONS
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {GRANT_GROUPS.map(group => (
              <Box key={group.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ fontSize: '0.72rem', color: 'var(--text-dim)', minWidth: 90, flexShrink: 0 }}>{group.label}</Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {group.grants.map(g => {
                    const granted = data.grants.includes(g.id);
                    return (
                      <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.3, fontSize: '0.72rem', color: granted ? 'var(--text-secondary)' : 'var(--text-dim)', opacity: granted ? 1 : 0.5 }}>
                        {granted ? <CheckIcon sx={{ fontSize: 13, color: 'var(--success)' }} /> : <CloseIcon sx={{ fontSize: 13, color: 'var(--text-dim)' }} />}
                        {g.label}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
