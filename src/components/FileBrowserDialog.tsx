'use client';

import { createPortal } from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { Box, CircularProgress } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import MemoryIcon from '@mui/icons-material/Memory';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import type { BrowseEntry, BrowseResult } from '@/types/filesystem';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { apiFetch } from '@/utils/api-client';

const ENTRY_ICONS = {
  directory:  { Icon: FolderIcon,          color: '#fbbf24' },
  executable: { Icon: MemoryIcon,          color: '#a78bfa' },
  file:       { Icon: InsertDriveFileIcon, color: 'var(--text-dim)' },
};

async function browse(p: string): Promise<BrowseResult> {
  return apiFetch(`/api/filesystem/browse?path=${encodeURIComponent(p)}`);
}

export function FileBrowserDialog({ initial, onSelect, onClose }: {
  initial?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BrowseEntry | null>(null);
  const [pathInput, setPathInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  async function navigate(p: string) {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const data = await browse(p);
      setResult(data);
      setPathInput(data.path);
      listRef.current?.scrollTo(0, 0);
    } catch (e: any) {
      setError(e.message || 'Cannot read directory');
    } finally {
      setLoading(false);
    }
  }

  // Start at the directory containing the initial value, or C:\
  useEffect(() => {
    const start = initial
      ? initial.includes('\\') ? initial.substring(0, initial.lastIndexOf('\\')) || initial : initial
      : 'C:\\';
    navigate(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePathInputKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') navigate(pathInput);
  }

  function handleEntryClick(entry: BrowseEntry) {
    if (entry.type === 'directory') {
      navigate(entry.path);
    } else {
      setSelected(prev => prev?.path === entry.path ? null : entry);
    }
  }

  function handleEntryDoubleClick(entry: BrowseEntry) {
    if (entry.type !== 'directory') onSelect(entry.path);
  }

  const canSelect = !!selected;

  return createPortal(
    <Box sx={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1360,
      display: 'flex', alignItems: 'center', justifyContent: 'center', p: '16px',
    }} onClick={onClose}>
      <Box sx={{
        width: '100%', maxWidth: 560, height: '80vh', maxHeight: 600,
        backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <DialogHeader title="BROWSE FILES" onClose={onClose} sx={{ mb: 1.5 }} />

          {/* Path bar */}
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <Box
              onClick={() => result?.parent && navigate(result.parent)}
              sx={{
                width: 32, height: 32, borderRadius: '7px', flexShrink: 0,
                border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: result?.parent ? 'pointer' : 'default',
                color: result?.parent ? 'var(--text-secondary)' : 'var(--border)',
                '&:hover': result?.parent ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {},
              }}
            >
              <ArrowUpwardIcon sx={{ fontSize: 15 }} />
            </Box>
            <input
              value={pathInput}
              onChange={e => setPathInput(e.target.value)}
              onKeyDown={handlePathInputKey}
              style={{
                flex: 1, padding: '0.4rem 0.65rem',
                backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: '0.78rem', outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              spellCheck={false}
            />
          </Box>
        </Box>

        {/* Quick access */}
        {result?.quickAccess && result.quickAccess.length > 0 && (
          <Box sx={{ px: 2, pt: 1.25, pb: 0.75, borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 0.6, flexShrink: 0 }}>
            {result.quickAccess.map(q => (
              <Box key={q.path} onClick={() => navigate(q.path)} sx={{
                px: 1.25, py: 0.35, borderRadius: 6, cursor: 'pointer',
                border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)',
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.65rem',
                letterSpacing: '0.05em', color: 'var(--text-secondary)',
                '&:hover': { borderColor: '#fbbf24', color: '#fbbf24' },
                transition: 'all 0.12s',
              }}>
                {q.label}
              </Box>
            ))}
          </Box>
        )}

        {/* File list */}
        <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
              <CircularProgress size={22} sx={{ color: 'var(--accent)' }} />
            </Box>
          )}
          {error && (
            <Box sx={{ px: 2, py: 1.5, fontSize: '0.78rem', color: 'var(--error)' }}>{error}</Box>
          )}
          {!loading && result?.entries.map(entry => {
            const { Icon, color } = ENTRY_ICONS[entry.type];
            const isSelected = selected?.path === entry.path;
            return (
              <Box
                key={entry.path}
                onClick={() => handleEntryClick(entry)}
                onDoubleClick={() => handleEntryDoubleClick(entry)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25,
                  px: 1.25, py: 0.7, borderRadius: '7px', cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(59,130,246,0.12)' : 'transparent',
                  border: `1px solid ${isSelected ? 'rgba(59,130,246,0.35)' : 'transparent'}`,
                  '&:hover': { backgroundColor: isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)' },
                  transition: 'all 0.1s',
                }}
              >
                <Icon sx={{ fontSize: 17, color, flexShrink: 0 }} />
                <Box sx={{
                  fontFamily: entry.type === 'directory' ? 'var(--font-body)' : 'var(--font-mono)',
                  fontSize: '0.82rem',
                  color: isSelected ? 'var(--text-primary)' : entry.type === 'directory' ? 'var(--text-secondary)' : 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontWeight: entry.type === 'directory' ? 500 : 400,
                }}>
                  {entry.name}
                </Box>
              </Box>
            );
          })}
          {!loading && result?.entries.length === 0 && (
            <Box sx={{ px: 2, py: 3, fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center' }}>Empty folder</Box>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2.5, py: 1.75, borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: selected ? 'var(--text-secondary)' : 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.path : 'Select a file'}
          </Box>
          <Box onClick={onClose} sx={{ px: 2, py: 0.65, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.78rem', '&:hover': { backgroundColor: 'var(--border)' }, flexShrink: 0 }}>
            CANCEL
          </Box>
          <Box
            onClick={canSelect ? () => onSelect(selected!.path) : undefined}
            sx={{
              px: 2, py: 0.65, borderRadius: 7, flexShrink: 0,
              backgroundColor: canSelect ? 'var(--accent)' : 'rgba(59,130,246,0.2)',
              color: canSelect ? 'white' : 'rgba(255,255,255,0.3)',
              cursor: canSelect ? 'pointer' : 'default',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.78rem',
            }}
          >
            SELECT
          </Box>
        </Box>
      </Box>
    </Box>,
    document.body
  );
}
