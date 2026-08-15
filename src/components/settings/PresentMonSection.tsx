'use client';

import { useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { AppConfig } from '@/types/app-config';
import { AppConfigApi } from '@/app/api/config/api';
import { useIsLocalhost } from '@/hooks/useIsLocalhost';
import { FileBrowserDialog } from '@/components/FileBrowserDialog';
import { HelpLink } from '@/components/ui/HelpLink';

type Status = 'idle' | 'testing' | 'ok' | 'error';

export function PresentMonSection({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const [value, setValue] = useState(config.presentMonPath);
  const [status, setStatus] = useState<Status>('idle');
  const [detail, setDetail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<Record<string, unknown> | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const isLocalhost = useIsLocalhost();

  // Show the current / auto-detected path on load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { test(); }, []);

  async function test() {
    setStatus('testing');
    setDetail(null);
    try {
      const result = await AppConfigApi.testPresentMon(value);
      setStatus(result.ok ? 'ok' : 'error');
      setDetail(result.detail);
    } catch {
      setStatus('error');
      setDetail('test failed');
    }
  }

  async function toggleDebug() {
    const opening = !debugOpen;
    setDebugOpen(opening);
    if (opening) {
      setDebugLoading(true);
      try {
        setDebugData(await AppConfigApi.debugPresentMon());
      } catch {
        setDebugData({ error: 'failed to fetch diagnostic' });
      } finally {
        setDebugLoading(false);
      }
    }
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({ ...config, presentMonPath: value });
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
          FRAME RATE (PresentMon)
        </Box>
        <HelpLink anchor="presentmon" />
      </Box>
      <Box sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)', mb: isLocalhost ? 2.5 : 1.5 }}>
        In-game FPS / frametimes via PresentMon (ETW). Requires the app to run elevated.
      </Box>

      {!isLocalhost && (
        <Box sx={{ mb: 2, px: 1.5, py: 1, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', fontSize: '0.75rem', color: 'var(--warning)', lineHeight: 1.5 }}>
          Read-only from remote devices — connect from the host PC to change this.
        </Box>
      )}

      <Box>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', mb: 0.5 }}>
          PRESENTMON EXECUTABLE
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box sx={{
            width: 34, height: 34, borderRadius: '8px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
          }}>
            <VideogameAssetIcon sx={{ fontSize: 17, color: '#a78bfa' }} />
          </Box>
          <input
            value={value}
            readOnly={!isLocalhost}
            placeholder="Leave blank to auto-detect (CapFrameX / FrameView / RTSS)"
            onChange={e => {
              if (!isLocalhost) return;
              setValue(e.target.value);
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
          {isLocalhost && (
            <Box
              onClick={() => setBrowseOpen(true)}
              sx={{
                width: 34, height: 34, borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
              }}
            >
              <FolderOpenIcon sx={{ fontSize: 16 }} />
            </Box>
          )}
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
          {detail ?? 'Blank auto-detects a bundled/installed PresentMon. FPS shows only while a game is presenting.'}
        </Box>

        {isLocalhost && (
          <Box sx={{ mt: 1 }}>
            <Box
              onClick={toggleDebug}
              sx={{
                fontSize: '0.68rem', color: 'var(--text-dim)', cursor: 'pointer', width: 'fit-content',
                textDecoration: 'underline', textUnderlineOffset: 2,
                '&:hover': { color: 'var(--text-secondary)' },
              }}
            >
              {debugOpen ? 'Hide diagnostic' : 'Show diagnostic'}
            </Box>
            {debugOpen && (
              <Box sx={{
                mt: 0.75, p: 1.25, borderRadius: 2, backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                color: 'var(--text-secondary)', maxHeight: 420, overflowY: 'auto', overflowX: 'hidden',
                width: '100%', boxSizing: 'border-box',
              }}>
                {debugLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'var(--text-dim)' }}>
                    <CircularProgress size={13} sx={{ color: 'inherit' }} />
                    running a fresh probe (up to a few seconds)...
                  </Box>
                ) : (
                  <>
                    {Object.entries(debugData ?? {}).map(([key, val]) => (
                      key === 'stdoutSample' || key === 'stderr' || key === 'args' ? null : (
                        <Box key={key} sx={{ mb: 0.5 }}>
                          <Box component="span" sx={{ color: 'var(--text-dim)' }}>{key}: </Box>
                          <Box component="span" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(val)}</Box>
                        </Box>
                      )
                    ))}
                    {Array.isArray(debugData?.args) && (
                      <Box sx={{ mb: 0.5 }}>
                        <Box sx={{ color: 'var(--text-dim)' }}>args:</Box>
                        <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{(debugData!.args as string[]).join(' ')}</Box>
                      </Box>
                    )}
                    {!!(debugData?.stderr as string)?.length && (
                      <Box sx={{ mt: 0.75 }}>
                        <Box sx={{ color: 'var(--text-dim)', mb: 0.25 }}>stderr:</Box>
                        <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--error)' }}>{debugData!.stderr as string}</Box>
                      </Box>
                    )}
                    {!!(debugData?.stdoutSample as string)?.length && (
                      <Box sx={{ mt: 0.75 }}>
                        <Box sx={{ color: 'var(--text-dim)', mb: 0.25 }}>stdout sample:</Box>
                        <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{debugData!.stdoutSample as string}</Box>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            )}
          </Box>
        )}
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
              SAVE PATH
            </Box>
          </Box>
        </Box>
      )}

      {browseOpen && (
        <FileBrowserDialog
          initial={value || 'C:\\Program Files (x86)'}
          onSelect={(p) => { setValue(p); setStatus('idle'); setDetail(null); setBrowseOpen(false); }}
          onClose={() => setBrowseOpen(false)}
        />
      )}
    </Box>
  );
}
