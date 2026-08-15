'use client';

import { useState } from 'react';
import { Box, Select, MenuItem, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useQuery } from '@tanstack/react-query';
import { AppConfig, LOG_LEVELS, LogLevelSetting } from '@/types/app-config';
import { apiFetch } from '@/utils/api-client';
import { useIsLocalhost } from '@/hooks/useIsLocalhost';

const LEVEL_COLOR: Record<string, string> = {
  ERROR: 'var(--error)',
  WARN: 'var(--warning)',
  INFO: 'var(--text-secondary)',
  DEBUG: 'var(--text-dim)',
};

function colorForLine(line: string): string {
  const match = line.match(/\]\s+(ERROR|WARN|INFO|DEBUG)/);
  return match ? LEVEL_COLOR[match[1]] ?? 'var(--text-secondary)' : 'var(--text-secondary)';
}

export function LogsSection({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const isLocalhost = useIsLocalhost();
  const [saving, setSaving] = useState(false);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['logs'],
    queryFn: () => apiFetch<{ lines: string[] }>('/api/logs?lines=500'),
    enabled: isLocalhost,
  });

  async function handleLevelChange(level: LogLevelSetting) {
    setSaving(true);
    try { await onSave({ ...config, logLevel: level }); }
    finally { setSaving(false); }
  }

  if (!isLocalhost) return null;

  const lines = data?.lines ?? [];

  return (
    <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
            LOGS
          </Box>
          <Box sx={{ fontSize: '0.72rem', color: 'var(--text-secondary)', mt: 0.25 }}>
            Written to %LOCALAPPDATA%\HandyMon\logs\app.log — host-only
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Select
            value={config.logLevel}
            onChange={e => handleLevelChange(e.target.value as LogLevelSetting)}
            size="small"
            disabled={saving}
            sx={{ fontSize: '0.78rem', backgroundColor: 'var(--bg-elevated)' }}
          >
            {LOG_LEVELS.map(l => (
              <MenuItem key={l} value={l} sx={{ fontSize: '0.78rem', textTransform: 'uppercase' }}>{l}</MenuItem>
            ))}
          </Select>
          <Box
            onClick={() => refetch()}
            title="Refresh"
            sx={{ width: 32, height: 32, flexShrink: 0, border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-dim)', '&:hover': { color: 'var(--text-primary)', borderColor: 'var(--text-secondary)' } }}
          >
            {isFetching ? <CircularProgress size={13} sx={{ color: 'var(--accent)' }} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px',
          p: 1.5, maxHeight: 360, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
          lineHeight: 1.6, display: 'flex', flexDirection: 'column-reverse',
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={16} sx={{ color: 'var(--accent)' }} /></Box>
        ) : lines.length === 0 ? (
          <Box sx={{ color: 'var(--text-dim)', textAlign: 'center', py: 1 }}>No log entries yet</Box>
        ) : (
          [...lines].reverse().map((line, i) => (
            <Box key={i} sx={{ color: colorForLine(line), whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</Box>
          ))
        )}
      </Box>
    </Box>
  );
}
