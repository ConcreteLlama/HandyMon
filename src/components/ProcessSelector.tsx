'use client';

import { useState, useRef, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AdsClickIcon from '@mui/icons-material/AdsClick';
import { useProcessList } from '@/hooks/processes/useProcessList';
import { useActiveWindowPid } from '@/hooks/windows/useActiveWindowPid';
import type { RunningProcess } from '@/types/processes';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const DROP_MAX_H = 260;

export function ProcessNameAutocomplete({
  value,
  onChange,
  placeholder = 'Process name (e.g. notepad.exe)',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isRefetching, refetch } = useProcessList();
  const { data: activeWindow } = useActiveWindowPid();
  const activePid = activeWindow?.pid;

  const allProcesses: RunningProcess[] = (data?.processes ?? [])
    .slice()
    .sort((a, b) => {
      // The currently-active (foreground) window's process is almost always
      // what the user actually wants — surface it first, ahead of CPU sort.
      if (activePid != null) {
        if (a.pid === activePid && b.pid !== activePid) return -1;
        if (b.pid === activePid && a.pid !== activePid) return 1;
      }
      return (b.cpu ?? 0) - (a.cpu ?? 0);
    });

  const filtered = query.trim()
    ? allProcesses.filter(p => p.exeName.toLowerCase().includes(query.toLowerCase()))
    : allProcesses;

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(p: RunningProcess) {
    onChange(p.exeName);
    setQuery(p.exeName);
    setOpen(false);
  }

  function pickTopCpu() {
    const top = allProcesses[0];
    if (top) { onChange(top.exeName); setQuery(top.exeName); }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.25,
        backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)',
        borderRadius: '6px', px: 0.5, height: 38,
        '&:focus-within': { borderColor: 'var(--accent)' }, transition: 'border-color 0.15s',
      }}>
        <input
          value={query}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && filtered.length > 0) { select(filtered[0]); e.preventDefault(); }
          }}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem', padding: '0 0.4rem',
          }}
          spellCheck={false}
          autoComplete="off"
        />

        <Box
          onClick={pickTopCpu}
          title="Select highest CPU process"
          sx={{
            width: 28, height: 28, borderRadius: '5px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-dim)', transition: 'all 0.15s',
            '&:hover': { color: 'var(--warning)', backgroundColor: 'rgba(251,191,36,0.08)' },
          }}
        >
          <TrendingUpIcon sx={{ fontSize: 16 }} />
        </Box>

        <Box
          onClick={() => refetch()}
          title="Refresh process list"
          sx={{
            width: 28, height: 28, borderRadius: '5px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-dim)', transition: 'all 0.15s',
            '&:hover': { color: 'var(--accent)', backgroundColor: 'rgba(59,130,246,0.08)' },
          }}
        >
          {isLoading || isRefetching
            ? <CircularProgress size={13} sx={{ color: 'var(--accent)' }} />
            : <RefreshIcon sx={{ fontSize: 16 }} />}
        </Box>
      </Box>

      {open && filtered.length > 0 && (
        <Box sx={{
          position: 'absolute', left: 0, right: 0, top: '100%', mt: '4px',
          zIndex: 1400,
          backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: '8px', overflowY: 'auto', maxHeight: DROP_MAX_H,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        }}>
          {filtered.map((p, i) => (
            <Box
              key={`${p.exeName}-${p.pid ?? i}`}
              onMouseDown={e => { e.preventDefault(); select(p); }}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                px: 1.5, py: 0.85, cursor: 'pointer', gap: 1.5,
                borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                '&:hover': { backgroundColor: 'var(--bg-elevated)' },
                transition: 'background 0.1s',
              }}
            >
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0, flex: 1,
              }}>
                {p.pid === activePid && (
                  <AdsClickIcon titleAccess="Currently active window" sx={{ fontSize: 13, color: 'var(--accent)', flexShrink: 0 }} />
                )}
                <Box sx={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
                  color: 'var(--text-primary)', minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.exeName}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0, alignItems: 'center' }}>
                {p.cpu != null && (
                  <Box sx={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                    color: p.cpu > 10 ? 'var(--warning)' : 'var(--text-dim)',
                    minWidth: 42, textAlign: 'right',
                  }}>
                    {p.cpu.toFixed(1)}%
                  </Box>
                )}
                {p.startTime != null && (
                  <Box sx={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                    color: 'var(--text-dim)', minWidth: 48, textAlign: 'right',
                  }}>
                    {new Date(p.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </div>
  );
}
