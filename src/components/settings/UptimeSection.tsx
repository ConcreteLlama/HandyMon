'use client';

import { Box } from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { useUptime } from '@/hooks/settings/useUptime';

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return '< 1m';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ flex: '1 1 140px', minWidth: 0 }}>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)' }}>{label}</Box>
      <Box sx={{ fontSize: '0.78rem', color: 'var(--text-primary)', mt: 0.2 }}>{value}</Box>
    </Box>
  );
}

export function UptimeSection() {
  const { data } = useUptime();

  const systemUptimeSec = data?.systemBootTimeIso
    ? (Date.now() - new Date(data.systemBootTimeIso).getTime()) / 1000
    : null;

  return (
    <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ScheduleIcon sx={{ fontSize: 18, color: 'var(--accent)' }} />
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
          UPTIME
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Stat label="SYSTEM" value={systemUptimeSec != null ? formatDuration(systemUptimeSec) : 'Unavailable'} />
        <Stat label="HANDYMON" value={data ? formatDuration(data.handyMonUptimeSec) : '—'} />
      </Box>
    </Box>
  );
}
