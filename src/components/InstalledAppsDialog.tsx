'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { useInstalledPrograms } from '@/hooks/programs/useInstalledPrograms';
import type { InstalledApp } from '@/app/api/programs/list/route';

const TYPE_BADGE: Record<InstalledApp['type'], { label: string; color: string; bg: string }> = {
  exe:      { label: 'EXE',  color: 'var(--accent)',  bg: 'rgba(59,130,246,0.12)' },
  uwp:      { label: 'UWP',  color: '#a78bfa',        bg: 'rgba(167,139,250,0.12)' },
  protocol: { label: 'URL',  color: 'var(--success)', bg: 'rgba(52,211,153,0.12)' },
};

export function InstalledAppsDialog({
  onSelect,
  onClose,
}: {
  onSelect: (program: string, args: string[], type: InstalledApp['type']) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const { data: apps, isLoading, isError } = useInstalledPrograms();

  const filtered = apps
    ? query.trim()
      ? apps.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
      : apps
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
          <DialogHeader title="INSTALLED APPS" onClose={onClose} />
        </Box>

        {/* Search */}
        <Box sx={{ px: 2.5, pb: 1.5, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.75, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', '&:focus-within': { borderColor: 'var(--accent)' }, transition: 'border-color 0.15s' }}>
            <SearchIcon sx={{ fontSize: 16, color: 'var(--text-dim)', flexShrink: 0 }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search apps…"
              autoFocus
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}
              spellCheck={false}
            />
            {query && (
              <CloseIcon onClick={() => setQuery('')} sx={{ fontSize: 14, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--text-primary)' } }} />
            )}
          </Box>
          {apps && (
            <Box sx={{ mt: 0.75, fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {filtered.length} / {apps.length} apps
            </Box>
          )}
        </Box>

        {/* List */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1.5 }}>
          {isLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6, gap: 1.5, color: 'var(--text-dim)', fontSize: '0.82rem' }}>
              <CircularProgress size={16} sx={{ color: 'var(--accent)' }} />
              Loading apps…
            </Box>
          )}
          {isError && (
            <Box sx={{ py: 4, textAlign: 'center', color: 'var(--error)', fontSize: '0.82rem' }}>
              Failed to load installed apps
            </Box>
          )}
          {filtered.map((app, i) => {
            const badge = TYPE_BADGE[app.type];
            return (
              <Box
                key={i}
                onClick={() => onSelect(app.program, app.args, app.type)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25,
                  px: 1.25, py: 0.875, borderRadius: '8px',
                  cursor: 'pointer', transition: 'background 0.1s',
                  '&:hover': { backgroundColor: 'var(--bg-elevated)' },
                }}
              >
                <Box sx={{ px: 0.65, py: 0.15, borderRadius: '4px', backgroundColor: badge.bg, color: badge.color, fontFamily: 'var(--font-display)', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.05em', flexShrink: 0, minWidth: 30, textAlign: 'center' }}>
                  {badge.label}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {app.name}
                  </Box>
                  <Box sx={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.1 }}>
                    {app.displayPath}
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
