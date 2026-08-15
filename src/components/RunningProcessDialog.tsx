'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { useWindowList } from '@/hooks/windows/useWindowList';

// Picks a running process's resolved .exe path — mainly useful for icon
// extraction on packaged/UWP apps (e.g. NVIDIA App), where the Start Menu
// entry has no direct .exe path to extract from, but a *running* instance
// does (Get-Process resolves MainModule.FileName into the real install path
// under WindowsApps).
export function RunningProcessDialog({
  onSelect,
  onClose,
}: {
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const { data: windows, isLoading, isError } = useWindowList();

  const filtered = windows
    ? query.trim()
      ? windows.filter(w => w.processName.toLowerCase().includes(query.toLowerCase()) || w.title.toLowerCase().includes(query.toLowerCase()))
      : windows
    : [];

  return createPortal(
    <Box
      sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1360, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '16px' }}
      onClick={onClose}
    >
      <Box
        sx={{ width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 32px)', backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, flexShrink: 0 }}>
          <DialogHeader title="RUNNING PROCESSES" onClose={onClose} />
        </Box>

        {/* Search */}
        <Box sx={{ px: 2.5, pb: 1.5, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.75, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', '&:focus-within': { borderColor: 'var(--accent)' }, transition: 'border-color 0.15s' }}>
            <SearchIcon sx={{ fontSize: 16, color: 'var(--text-dim)', flexShrink: 0 }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search running apps…"
              autoFocus
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}
              spellCheck={false}
            />
            {query && (
              <CloseIcon onClick={() => setQuery('')} sx={{ fontSize: 14, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--text-primary)' } }} />
            )}
          </Box>
          {windows && (
            <Box sx={{ mt: 0.75, fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {filtered.length} / {windows.length} running
            </Box>
          )}
        </Box>

        {/* List */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1.5 }}>
          {isLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6, gap: 1.5, color: 'var(--text-dim)', fontSize: '0.82rem' }}>
              <CircularProgress size={16} sx={{ color: 'var(--accent)' }} />
              Loading running apps…
            </Box>
          )}
          {isError && (
            <Box sx={{ py: 4, textAlign: 'center', color: 'var(--error)', fontSize: '0.82rem' }}>
              Failed to load running processes
            </Box>
          )}
          {!isLoading && filtered.length === 0 && (
            <Box sx={{ py: 4, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
              No matching windows open right now
            </Box>
          )}
          {filtered.map(w => {
            const disabled = !w.path;
            return (
              <Box
                key={w.pid}
                onClick={() => { if (w.path) onSelect(w.path); }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25,
                  px: 1.25, py: 0.875, borderRadius: '8px',
                  cursor: disabled ? 'default' : 'pointer', transition: 'background 0.1s',
                  opacity: disabled ? 0.5 : 1,
                  '&:hover': disabled ? {} : { backgroundColor: 'var(--bg-elevated)' },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.processName}
                  </Box>
                  <Box sx={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.1 }}>
                    {w.title}
                  </Box>
                  <Box sx={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.1 }}>
                    {w.path ?? 'No path available'}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>,
    document.body
  );
}
