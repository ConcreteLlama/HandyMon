'use client';

import { useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SpeedIcon from '@mui/icons-material/Speed';
import { AppConfig } from '@/types/app-config';
import { AppConfigApi } from '@/app/api/config/api';
import { useIsLocalhost } from '@/hooks/useIsLocalhost';
import { HelpLink } from '@/components/ui/HelpLink';

type Status = 'idle' | 'testing' | 'ok' | 'error';

export function LhmSection({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const [port, setPort] = useState(String(config.lhmPort));
  const [status, setStatus] = useState<Status>('idle');
  const [detail, setDetail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isLocalhost = useIsLocalhost();

  const portNum = Number(port);
  const portValid = Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;

  async function test() {
    if (!portValid) { setStatus('error'); setDetail('invalid port'); return; }
    setStatus('testing');
    setDetail(null);
    try {
      const result = await AppConfigApi.testLhm(portNum);
      setStatus(result.ok ? 'ok' : 'error');
      setDetail(result.detail);
    } catch {
      setStatus('error');
      setDetail('test failed');
    }
  }

  async function save() {
    if (!portValid) { setSaveError('Port must be between 1 and 65535'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({ ...config, lhmPort: portNum });
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
          PERFORMANCE MONITORING
        </Box>
        <HelpLink anchor="lhm" />
      </Box>
      <Box sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)', mb: isLocalhost ? 2.5 : 1.5 }}>
        LibreHardwareMonitor web server — source for CPU/GPU temps, power, clocks and fans
      </Box>

      {!isLocalhost && (
        <Box sx={{ mb: 2, px: 1.5, py: 1, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', fontSize: '0.75rem', color: 'var(--warning)', lineHeight: 1.5 }}>
          Read-only from remote devices — connect from the host PC to change this.
        </Box>
      )}

      <Box>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', mb: 0.5 }}>
          WEB SERVER PORT
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box sx={{
            width: 34, height: 34, borderRadius: '8px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
          }}>
            <SpeedIcon sx={{ fontSize: 17, color: '#10b981' }} />
          </Box>
          <input
            type="number"
            min={1}
            max={65535}
            value={port}
            readOnly={!isLocalhost}
            onChange={e => {
              if (!isLocalhost) return;
              setPort(e.target.value);
              setStatus('idle');
              setDetail(null);
            }}
            style={{
              flex: 1, padding: '0.55rem 0.75rem',
              backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 6, color: isLocalhost ? 'var(--text-primary)' : 'var(--text-dim)',
              fontFamily: 'var(--font-mono)', fontSize: '0.8rem', outline: 'none',
              cursor: isLocalhost ? 'text' : 'default',
            }}
            onFocus={e => { if (isLocalhost) e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            spellCheck={false}
          />
          <Box
            onClick={status === 'testing' ? undefined : test}
            sx={{
              px: 1.5, py: 0.6, borderRadius: 6, border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.72rem',
              letterSpacing: '0.05em', cursor: status === 'testing' ? 'default' : 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 0.5,
              '&:hover': { backgroundColor: 'var(--border)' },
            }}
          >
            {status === 'testing' && <CircularProgress size={11} sx={{ color: 'inherit' }} />}
            {status === 'ok' && <CheckCircleOutlineIcon sx={{ fontSize: 13, color: 'var(--success)' }} />}
            {status === 'error' && <ErrorOutlineIcon sx={{ fontSize: 13, color: 'var(--error)' }} />}
            TEST
          </Box>
        </Box>
        <Box sx={{ fontSize: '0.68rem', mt: 0.4, color: status === 'ok' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--text-dim)' }}>
          {detail ?? 'Set in LHM under Options → Remote Web Server (default 8085). Requires PawnIO for CPU/motherboard sensors.'}
        </Box>
      </Box>

      {isLocalhost && (
        <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {saveError && <Box sx={{ fontSize: '0.75rem', color: 'var(--error)' }}>{saveError}</Box>}
          <Box sx={{ ml: 'auto' }}>
            <Box
              onClick={!saving ? save : undefined}
              sx={{
                px: 2.5, py: 0.8, borderRadius: 8, backgroundColor: saving ? 'rgba(59,130,246,0.3)' : 'var(--accent)',
                color: saving ? 'rgba(255,255,255,0.4)' : 'white', cursor: saving ? 'default' : 'pointer',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.06em',
                display: 'flex', alignItems: 'center', gap: 1, transition: 'all 0.15s',
              }}
            >
              {saving && <CircularProgress size={13} sx={{ color: 'inherit' }} />}
              SAVE PORT
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
