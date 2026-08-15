'use client';

import { useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import MemoryIcon from '@mui/icons-material/Memory';
import { AppConfig } from '@/types/app-config';
import { AppConfigApi } from '@/app/api/config/api';
import { useIsLocalhost } from '@/hooks/useIsLocalhost';
import { HelpLink } from '@/components/ui/HelpLink';

type PathStatus = 'idle' | 'testing' | 'ok' | 'error';

const FIELDS: { key: keyof AppConfig; label: string; hint: string; kind: 'exe' | 'folder'; helpAnchor: string }[] = [
  { key: 'rtssInstallPath',            label: 'RTSS Installation Folder',            hint: 'Folder containing RTSS.exe',               kind: 'folder', helpAnchor: 'rtss' },
  { key: 'fanControlPath',             label: 'FanControl Folder',                   hint: 'Folder containing FanControl.exe',         kind: 'folder', helpAnchor: 'fancontrol' },
  { key: 'processLassoConfigPath',     label: 'Process Lasso Config Folder',         hint: 'Folder containing the config/ directory',  kind: 'folder', helpAnchor: 'processlasso' },
];

const TYPE_MAP: Partial<Record<keyof AppConfig, string>> = {
  rtssInstallPath: 'rtss',
  fanControlPath: 'fanControl',
  processLassoConfigPath: 'processLasso',
};

export function ToolPathsSection({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const [values, setValues] = useState({
    rtssInstallPath: config.rtssInstallPath,
    fanControlPath: config.fanControlPath,
    processLassoConfigPath: config.processLassoConfigPath,
  });
  const [statuses, setStatuses] = useState<Record<string, PathStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isLocalhost = useIsLocalhost();

  async function test(key: string) {
    setStatuses(s => ({ ...s, [key]: 'testing' }));
    const result = await AppConfigApi.validate(TYPE_MAP[key as keyof AppConfig] ?? key, values[key as keyof typeof values]);
    setStatuses(s => ({ ...s, [key]: result.ok ? 'ok' : 'error' }));
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({ ...config, ...values });
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3 }}>
      <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)', mb: 0.5 }}>
        TOOL PATHS
      </Box>
      <Box sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)', mb: isLocalhost ? 2.5 : 1.5 }}>
        Paths to external tools used by this app
      </Box>

      {!isLocalhost && (
        <Box sx={{ mb: 2, px: 1.5, py: 1, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', fontSize: '0.75rem', color: 'var(--warning)', lineHeight: 1.5 }}>
          Read-only from remote devices — connect from the host PC to change tool paths.
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {FIELDS.map(({ key, label, hint, kind, helpAnchor }) => {
          const status = statuses[key] ?? 'idle';
          return (
            <Box key={key}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)' }}>
                  {label}
                </Box>
                <HelpLink anchor={helpAnchor} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Box sx={{
                  width: 34, height: 34, borderRadius: '8px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: kind === 'folder' ? 'rgba(251,191,36,0.1)' : 'rgba(139,92,246,0.12)',
                  border: `1px solid ${kind === 'folder' ? 'rgba(251,191,36,0.25)' : 'rgba(139,92,246,0.3)'}`,
                }}>
                  {kind === 'folder'
                    ? <FolderOutlinedIcon sx={{ fontSize: 17, color: '#fbbf24' }} />
                    : <MemoryIcon        sx={{ fontSize: 17, color: '#a78bfa' }} />
                  }
                </Box>
                <input
                  value={values[key as keyof typeof values]}
                  readOnly={!isLocalhost}
                  onChange={e => {
                    if (!isLocalhost) return;
                    setValues(v => ({ ...v, [key]: e.target.value }));
                    setStatuses(s => ({ ...s, [key]: 'idle' }));
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
                  onClick={() => test(key)}
                  sx={{
                    px: 1.5, py: 0.6, borderRadius: 6, border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.72rem',
                    letterSpacing: '0.05em', cursor: 'pointer', flexShrink: 0,
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
              <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', mt: 0.4 }}>{hint}</Box>
            </Box>
          );
        })}
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
              SAVE PATHS
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
