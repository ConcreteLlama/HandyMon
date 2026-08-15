'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Box, CircularProgress } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseIcon from '@mui/icons-material/Close';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import MemoryIcon from '@mui/icons-material/Memory';
import AdsClickIcon from '@mui/icons-material/AdsClick';
import { useWindowList } from '@/hooks/windows/useWindowList';
import { useActiveWindowPid } from '@/hooks/windows/useActiveWindowPid';
import { useFocusWindow } from '@/hooks/windows/useFocusWindow';
import { useCloseWindow } from '@/hooks/windows/useCloseWindow';
import { useKillWindow } from '@/hooks/windows/useKillWindow';
import { useProcessUsage } from '@/hooks/processes/useProcessUsage';
import { useProcessDetail } from '@/hooks/processes/useProcessDetail';
import { useProcessLassoInfo } from '@/hooks/process-lasso/useProcessLassoInfo';
import { useProcessLassoConfig, PROCESS_LASSO_CONFIG_KEY } from '@/hooks/process-lasso/useProcessLassoConfig';
import { useProcessRulePresets, useSaveProcessRulePreset, useDeleteProcessRulePreset } from '@/hooks/process-lasso/useProcessRulePresets';
import { useGrants } from '@/hooks/auth/useGrants';
import { ProcessLassoApi } from '@/app/api/process-lasso/api';
import { ProcessRulePicker } from '@/components/ui/ProcessRulePicker';
import type { WindowInfo } from '@/types/windows';
import type { ProcessUsage } from '@/types/processes';
import { helpProps } from '@/components/help/HelpModeContext';

type SortKey = 'name' | 'cpu' | 'ram' | 'uptime';
type ViewMode = 'windows' | 'all';
type ProcessRow = WindowInfo & { hasWindow: boolean };

function fmtRam(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}G` : `${mb}M`;
}

function relTime(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

// ── Detail modal ─────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)', width: 78, flexShrink: 0, pt: 0.2 }}>{label}</Box>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{value}</Box>
    </Box>
  );
}

function CpuSetAssign({ exe }: { exe: string }) {
  const { coreCount } = useProcessLassoInfo();
  const { data: lassoConfig } = useProcessLassoConfig();
  const presets = useProcessRulePresets();
  const savePreset = useSaveProcessRulePreset();
  const deletePreset = useDeleteProcessRulePreset();
  const qc = useQueryClient();
  // exe names are case-insensitive on Windows, so match the same way rather
  // than risk a false "not configured" over casing alone.
  const existing = lassoConfig?.ProcessDefaults?.CPUSets?.find(cs => cs.exe.toLowerCase() === exe.toLowerCase());
  const [cores, setCores] = useState<number[]>(existing?.cores ?? []);
  const [touched, setTouched] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState(false);

  useEffect(() => {
    if (!touched) setCores(existing?.cores ?? []);
  }, [existing, touched]);

  async function assign() {
    if (cores.length === 0) return;
    setAssigning(true);
    try {
      await ProcessLassoApi.config.cpuSets.set(exe, cores);
      qc.invalidateQueries({ queryKey: PROCESS_LASSO_CONFIG_KEY });
      setAssigned(true);
      setTimeout(() => setAssigned(false), 1500);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <Box sx={{ mt: 0.5 }}>
      <Box
        {...helpProps('CPU Set', "Quick-assign which CPU cores this process is restricted to, via Process Lasso — the same setting as the CPU Set picker in Process Lasso's own tab, just reachable straight from here. Pick cores then tap ASSIGN.")}
        sx={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-dim)', mb: 0.5 }}
      >
        CPU SET{existing ? ' — CONFIGURED' : ''}
      </Box>
      <ProcessRulePicker
        coreCount={coreCount}
        value={cores}
        onChange={c => { setTouched(true); setCores(c); }}
        presets={presets}
        onSavePreset={savePreset}
        onDeletePreset={deletePreset}
        showSaveAsPresetLink={false}
      />
      <Box
        onClick={assigning || cores.length === 0 ? undefined : assign}
        sx={{
          mt: 1, px: 1.5, py: 0.7, borderRadius: 7, border: '1px solid var(--border)',
          color: assigned ? '#10b981' : 'var(--text-secondary)', cursor: assigning || cores.length === 0 ? 'default' : 'pointer',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', opacity: cores.length === 0 ? 0.5 : 1,
          '&:hover': cores.length ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined,
        }}
      >
        {assigning ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : assigned ? 'ASSIGNED' : 'ASSIGN'}
      </Box>
    </Box>
  );
}

function ProcessDetailModal({ window: w, usage, onClose, onKill, onCloseWindow, onFocus, canKill }: {
  window: ProcessRow; usage: ProcessUsage | undefined; onClose: () => void; onKill: () => void; onCloseWindow: () => void; onFocus: () => void; canKill: boolean;
}) {
  const { data: detail, isLoading } = useProcessDetail(w.pid);
  const { available: lassoAvailable } = useProcessLassoInfo();
  const { has: hasGrant } = useGrants();
  return createPortal(
    <Box sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }} onClick={onClose}>
      <Box sx={{ width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto', backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }} onClick={e => e.stopPropagation()}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {w.processName}
          </Box>
          <Box onClick={onClose} sx={{ cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', '&:hover': { color: 'var(--text-primary)' } }}><CloseIcon sx={{ fontSize: 18 }} /></Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {([['CPU', usage ? `${usage.cpu.toFixed(1)}%` : '—'], ['RAM', usage ? fmtRam(usage.ram) : '—'], ['PID', String(w.pid)]] as const).map(([l, v]) => (
            <Box key={l} sx={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px', px: 1.5, py: 1, textAlign: 'center' }}>
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{v}</Box>
              <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)', mt: 0.3 }}>{l}</Box>
            </Box>
          ))}
        </Box>

        {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={18} sx={{ color: 'var(--accent)' }} /></Box>}
        {detail && (
          <Box>
            <DetailRow label="TITLE" value={w.title || '—'} />
            <DetailRow label="PATH" value={detail.path ?? '—'} />
            {detail.commandLine && <DetailRow label="COMMAND" value={detail.commandLine} />}
            <DetailRow label="THREADS" value={detail.threads != null ? String(detail.threads) : '—'} />
            <DetailRow label="CPU TIME" value={detail.cpuSeconds != null ? `${detail.cpuSeconds}s` : '—'} />
            <DetailRow label="UPTIME" value={detail.startTime != null ? relTime(detail.startTime) : '—'} />
          </Box>
        )}
        {detail === null && !isLoading && (
          <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', py: 1 }}>Process no longer running</Box>
        )}

        {lassoAvailable && hasGrant('processlasso:write') && <CpuSetAssign exe={w.processName} />}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
          {hasGrant('processes:focus') && w.hasWindow && (
            <Box onClick={onFocus} sx={{ px: 2, py: 0.7, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 0.6, '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-dim)' } }}>
              <FlipToFrontIcon sx={{ fontSize: 15 }} /> BRING TO FRONT
            </Box>
          )}
          {canKill && w.hasWindow && (
            <Box
              onClick={onCloseWindow}
              {...helpProps('Close Window', "Sends a normal close request (like clicking the X) — the app can prompt to save unsaved work, or ignore the request entirely if it's unresponsive. Try this before KILL PROCESS.")}
              sx={{ px: 2, py: 0.7, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 0.6, '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-dim)' } }}
            >
              <CloseIcon sx={{ fontSize: 15 }} /> CLOSE WINDOW
            </Box>
          )}
          {canKill && (
            <Box
              onClick={onKill}
              {...helpProps('Kill Process', "Force-terminates the process immediately — no chance to save unsaved work, and any prompts it would've shown are skipped entirely. Use when CLOSE WINDOW doesn't work or the process has no window at all.")}
              sx={{ px: 2, py: 0.7, borderRadius: 7, border: '1px solid var(--error)', color: 'var(--error)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 0.6, '&:hover': { backgroundColor: 'rgba(239,68,68,0.1)' } }}
            >
              <PowerSettingsNewIcon sx={{ fontSize: 15 }} /> KILL PROCESS
            </Box>
          )}
        </Box>
      </Box>
    </Box>,
    document.body
  );
}

// ── Kill confirm ─────────────────────────────────────────────────────────────

function KillConfirm({ window: w, onConfirm, onCancel }: {
  window: ProcessRow; onConfirm: () => void; onCancel: () => void;
}) {
  return createPortal(
    <Box sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 310, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }} onClick={onCancel}>
      <Box sx={{ width: '100%', maxWidth: 320, backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }} onClick={e => e.stopPropagation()}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>KILL PROCESS</Box>
        <Box sx={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Kill <strong style={{ color: 'var(--text-primary)' }}>{w.processName}</strong>?
          {w.title && <Box component="span" sx={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', mt: 0.5, fontFamily: 'var(--font-mono)' }}>{w.title}</Box>}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
          <Box onClick={onCancel} sx={{ px: 2, py: 0.75, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem', '&:hover': { backgroundColor: 'var(--border)' } }}>CANCEL</Box>
          <Box onClick={onConfirm} sx={{ px: 2, py: 0.75, borderRadius: 7, backgroundColor: 'var(--error)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem' }}>KILL</Box>
        </Box>
      </Box>
    </Box>,
    document.body
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

export function TaskSwitcherSection() {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('cpu');
  const [sortDesc, setSortDesc] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('windows');
  const [justFocused, setJustFocused] = useState<number | null>(null);
  const [killTarget, setKillTarget] = useState<ProcessRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<ProcessRow | null>(null);
  const iconCacheRef = useRef<Record<string, string | null>>({});
  const [iconCache, setIconCache] = useState<Record<string, string | null>>({});
  const { data: windows, isFetching, refetch } = useWindowList();
  const { data: activeWindow } = useActiveWindowPid();
  const { data: usage, isLoading: usageLoading } = useProcessUsage();
  const populating = viewMode === 'all' ? usageLoading : !windows;
  const focusMutation = useFocusWindow();
  const closeMutation = useCloseWindow();
  const killMutation = useKillWindow();
  const { has: hasGrant } = useGrants();
  const canKill = hasGrant('processes:kill');
  const canFocus = hasGrant('processes:focus');

  useEffect(() => {
    if (!windows) return;
    const paths = [...new Set(windows.filter(w => w.path && !(w.path in iconCacheRef.current)).map(w => w.path!))];
    if (!paths.length) return;
    paths.forEach(p => { iconCacheRef.current[p] = null; });
    paths.forEach(exePath => {
      apiFetch<{ icon?: string }>('/api/actions/extract-icon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ program: exePath }) })
        .then(({ icon }) => { if (icon) { iconCacheRef.current[exePath] = icon; setIconCache(c => ({ ...c, [exePath]: icon })); } })
        .catch(() => {});
    });
  }, [windows]);

  const rows: ProcessRow[] = useMemo(() => {
    const windowRows: ProcessRow[] = (windows ?? []).map(w => ({ ...w, hasWindow: true }));
    if (viewMode === 'windows') return windowRows;

    const windowMap = new Map(windowRows.map(w => [w.pid, w]));
    const merged: ProcessRow[] = [];
    for (const [pid, u] of usage) {
      const w = windowMap.get(pid);
      merged.push(w ?? { pid, processName: u.name || String(pid), title: '', path: null, hasWindow: false });
    }
    // Usage (WMI perf counters) can lag process creation by a poll cycle — keep any windowed
    // process it hasn't caught up to yet so a just-launched app doesn't briefly disappear.
    for (const w of windowRows) {
      if (!usage.has(w.pid)) merged.push(w);
    }
    return merged;
  }, [windows, usage, viewMode]);

  function handleFocus(w: ProcessRow) {
    focusMutation.mutate({ pid: w.pid }, {
      onSuccess: () => { setJustFocused(w.pid); setTimeout(() => setJustFocused(f => f === w.pid ? null : f), 1500); },
    });
  }

  function handleCloseWindow(w: ProcessRow) {
    closeMutation.mutate({ pid: w.pid }, {
      onSettled: () => refetch(),
    });
  }

  function handleKillConfirm() {
    if (!killTarget) return;
    killMutation.mutate({ pid: killTarget.pid }, {
      onSettled: () => { setKillTarget(null); setDetailTarget(null); refetch(); },
    });
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDesc(d => !d);
    else { setSortKey(key); setSortDesc(key !== 'name'); }
  }

  const filtered = rows.filter(w => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return w.title.toLowerCase().includes(q) || w.processName.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') cmp = a.processName.localeCompare(b.processName, undefined, { sensitivity: 'base' });
    else if (sortKey === 'cpu') cmp = (usage.get(a.pid)?.cpu ?? -1) - (usage.get(b.pid)?.cpu ?? -1);
    else if (sortKey === 'ram') cmp = (usage.get(a.pid)?.ram ?? -1) - (usage.get(b.pid)?.ram ?? -1);
    // Higher startTime = launched more recently, so descending (the default) surfaces newest processes first.
    else cmp = (usage.get(a.pid)?.startTime ?? -1) - (usage.get(b.pid)?.startTime ?? -1);
    return sortDesc ? -cmp : cmp;
  });

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <Box onClick={() => toggleSort(k)} sx={{
      display: 'flex', alignItems: 'center', gap: 0.3, px: 1, py: 0.4, borderRadius: 6, cursor: 'pointer',
      fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em',
      color: sortKey === k ? 'var(--accent)' : 'var(--text-dim)',
      backgroundColor: sortKey === k ? 'rgba(59,130,246,0.08)' : 'transparent',
      '&:hover': { color: 'var(--text-secondary)' },
    }}>
      {label}
      {sortKey === k && (sortDesc ? <ArrowDownwardIcon sx={{ fontSize: 11 }} /> : <ArrowUpwardIcon sx={{ fontSize: 11 }} />)}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', px: 1.5, height: 38 }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: 'var(--text-dim)', flexShrink: 0 }} />
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by title or process…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }} />
        </Box>
        <Box onClick={() => refetch()} title="Refresh" sx={{ width: 38, height: 38, flexShrink: 0, border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-dim)', '&:hover': { color: 'var(--text-primary)', borderColor: 'var(--text-secondary)' } }}>
          {isFetching ? <CircularProgress size={14} sx={{ color: 'var(--accent)' }} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, pl: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.58rem', color: 'var(--text-dim)', letterSpacing: '0.06em', mr: 0.5 }}>SORT</Box>
          <SortBtn k="name" label="NAME" />
          <SortBtn k="cpu" label="CPU" />
          <SortBtn k="ram" label="RAM" />
          <SortBtn k="uptime" label="UPTIME" />
        </Box>
        <Box
          {...helpProps('Windows / All', 'WINDOWS shows only processes with an actual open window (what you could Alt-Tab to). ALL shows every running process on the system, including background services with no window at all.')}
          sx={{ display: 'flex', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '7px', p: 0.25 }}
        >
          {([['windows', 'WINDOWS'], ['all', 'ALL']] as const).map(([mode, label]) => (
            <Box key={mode} onClick={() => setViewMode(mode)} sx={{
              px: 1.1, py: 0.35, borderRadius: '5px', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em',
              color: viewMode === mode ? 'var(--accent)' : 'var(--text-dim)',
              backgroundColor: viewMode === mode ? 'rgba(59,130,246,0.1)' : 'transparent',
              '&:hover': { color: viewMode === mode ? 'var(--accent)' : 'var(--text-secondary)' },
            }}>
              {label}
            </Box>
          ))}
        </Box>
      </Box>

      {populating && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 0.5 }}>
          <CircularProgress size={12} sx={{ color: 'var(--accent)' }} />
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.62rem', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
            Loading {viewMode === 'all' ? 'all processes' : 'windows'}…
          </Box>
        </Box>
      )}

      {sorted.length === 0 ? (
        <Box sx={{ py: 5, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
          {!windows ? 'Loading…' : filter ? 'No matching processes' : viewMode === 'all' ? 'No processes' : 'No open windows'}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {sorted.map(w => {
            const icon = w.path ? iconCache[w.path] : null;
            const focused = justFocused === w.pid;
            const isActiveWindow = activeWindow?.pid === w.pid;
            const highlighted = focused || isActiveWindow;
            const u = usage.get(w.pid);
            return (
              <Box key={w.pid} onClick={() => setDetailTarget(w)} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1, borderRadius: '10px', border: `1px solid ${highlighted ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: highlighted ? 'rgba(59,130,246,0.06)' : 'var(--bg-elevated)', cursor: 'pointer', '&:hover': { borderColor: highlighted ? 'var(--accent)' : 'var(--text-dim)' } }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '6px', flexShrink: 0, backgroundColor: 'var(--bg-base)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {icon ? <img src={icon} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} /> : <Box sx={{ width: 20, height: 20, borderRadius: '4px', backgroundColor: 'var(--border)' }} />}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {highlighted && (focused
                      ? <CheckCircleIcon titleAccess="Brought to front" sx={{ fontSize: 14, color: 'var(--accent)', flexShrink: 0 }} />
                      : <AdsClickIcon titleAccess="Currently active window" sx={{ fontSize: 14, color: 'var(--accent)', flexShrink: 0 }} />)}
                    <Box sx={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{w.title || w.processName}</Box>
                  </Box>
                  {w.title && <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', mt: 0.15 }}>{w.processName}</Box>}
                </Box>

                {/* Usage */}
                <Box sx={{ flexShrink: 0, textAlign: 'right', minWidth: 44 }}>
                  {sortKey === 'uptime' ? (
                    <>
                      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{u?.startTime != null ? relTime(u.startTime) : '—'}</Box>
                      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: 'var(--text-dim)' }}>{u ? `${u.cpu.toFixed(0)}%` : ''}</Box>
                    </>
                  ) : (
                    <>
                      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 700, color: (u?.cpu ?? 0) > 15 ? '#f59e0b' : 'var(--text-secondary)' }}>{u ? `${u.cpu.toFixed(0)}%` : '—'}</Box>
                      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: 'var(--text-dim)' }}>{u ? fmtRam(u.ram) : ''}</Box>
                    </>
                  )}
                </Box>

                {canFocus && w.hasWindow && (
                  <Box onClick={e => { e.stopPropagation(); handleFocus(w); }} title={`Bring ${w.processName} to front`} sx={{ width: 26, height: 26, borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-dim)', '&:hover': { color: 'var(--accent)', backgroundColor: 'rgba(59,130,246,0.1)' } }}>
                    <FlipToFrontIcon sx={{ fontSize: 16 }} />
                  </Box>
                )}
                {canKill && w.hasWindow && (
                  <Box onClick={e => { e.stopPropagation(); handleCloseWindow(w); }} title={`Close ${w.processName}`} sx={{ width: 26, height: 26, borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-dim)', '&:hover': { color: 'var(--accent)', backgroundColor: 'rgba(59,130,246,0.1)' } }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </Box>
                )}
                {canKill && (
                  <Box onClick={e => { e.stopPropagation(); setKillTarget(w); }} title={`Kill ${w.processName}`} sx={{ width: 26, height: 26, borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-dim)', '&:hover': { color: 'var(--error)', backgroundColor: 'rgba(239,68,68,0.1)' } }}>
                    <PowerSettingsNewIcon sx={{ fontSize: 16 }} />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {detailTarget && (
        <ProcessDetailModal window={detailTarget} usage={usage.get(detailTarget.pid)} onClose={() => setDetailTarget(null)} onKill={() => setKillTarget(detailTarget)} onCloseWindow={() => handleCloseWindow(detailTarget)} onFocus={() => handleFocus(detailTarget)} canKill={canKill} />
      )}
      {killTarget && (
        <KillConfirm window={killTarget} onConfirm={handleKillConfirm} onCancel={() => setKillTarget(null)} />
      )}
    </Box>
  );
}
