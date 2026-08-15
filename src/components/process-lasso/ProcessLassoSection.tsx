'use client';

import { useState, useRef } from 'react';
import {
  Box, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Checkbox,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import MemoryIcon from '@mui/icons-material/Memory';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import CheckIcon from '@mui/icons-material/Check';
import TuneIcon from '@mui/icons-material/Tune';
import ChecklistIcon from '@mui/icons-material/Checklist';
import SpeedIcon from '@mui/icons-material/Speed';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseIcon from '@mui/icons-material/Close';
import { ProcessLassoApi } from '@/app/api/process-lasso/api';
import { formatCoreRanges, matchProcessRulePreset } from '@/utils/proces-lasso/process-rule-presets';
import { IoPriorityLevel, IO_PRIORITY_LABELS, CpuPriorityLevel, CPU_PRIORITY_LABELS } from '@/utils/proces-lasso/process-lasso';
import { ProcessRulePreset } from '@/types/app-config';
import { ProcessRulePicker, ManagePresetsDialog, presetSubLabel } from '../ui/ProcessRulePicker';
import { IoPrioritySelector, IO_PRIORITY_COLORS } from '../ui/IoPrioritySelector';
import { CpuPrioritySelector, CPU_PRIORITY_COLORS } from '../ui/CpuPrioritySelector';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { FormLabel } from '../ui/FormLabel';
import { HelpLink } from '../ui/HelpLink';
import { ProcessNameAutocomplete } from '../ProcessSelector';
import { useGrants } from '@/hooks/auth/useGrants';
import { useProcessLassoInfo } from '@/hooks/process-lasso/useProcessLassoInfo';
import { useProcessLassoConfig, PROCESS_LASSO_CONFIG_KEY } from '@/hooks/process-lasso/useProcessLassoConfig';
import { useProcessRulePresets, useSaveProcessRulePreset, useDeleteProcessRulePreset } from '@/hooks/process-lasso/useProcessRulePresets';
import { helpProps } from '@/components/help/HelpModeContext';

type ProcessRule = { exe: string; cores?: number[]; priority?: IoPriorityLevel; cpuPriority?: CpuPriorityLevel; performanceMode?: boolean };

export const ProcessLassoSection = () => {
  const { has } = useGrants();
  const canWrite = has('processlasso:write');
  const { coreCount, available } = useProcessLassoInfo();
  const presets = useProcessRulePresets();
  const savePreset = useSaveProcessRulePreset();
  const deletePreset = useDeleteProcessRulePreset();
  const qc = useQueryClient();
  const { data: config } = useProcessLassoConfig(available);
  const [addOpen, setAddOpen] = useState(false);
  const [editingExe, setEditingExe] = useState<string | null>(null);
  const [selectedProcess, setSelectedProcess] = useState('');
  const [selectedCores, setSelectedCores] = useState<number[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<IoPriorityLevel | null>(null);
  const [selectedCpuPriority, setSelectedCpuPriority] = useState<CpuPriorityLevel | null>(null);
  const [selectedPerformanceMode, setSelectedPerformanceMode] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [managingPresets, setManagingPresets] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedExes, setSelectedExes] = useState<Set<string>>(new Set());
  // Which preset's matches the current selection was last set to via the
  // "select all matching a preset" shortcut — null once the selection is
  // manually touched (checkbox click) or cleared, so a repeat click on the
  // same preset chip can toggle it off instead of just re-adding.
  const [activeSelectPreset, setActiveSelectPreset] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCores, setBulkCores] = useState<number[]>([]);
  const [bulkApplyCores, setBulkApplyCores] = useState(false);
  const [bulkPriority, setBulkPriority] = useState<IoPriorityLevel | null>(null);
  const [bulkCpuPriority, setBulkCpuPriority] = useState<CpuPriorityLevel | null>(null);
  const [bulkApplyPerformanceMode, setBulkApplyPerformanceMode] = useState(false);
  const [bulkPerformanceMode, setBulkPerformanceMode] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragRef = useRef<{ exe: string; startY: number } | null>(null);
  const [dragDy, setDragDy] = useState<{ exe: string; dy: number } | null>(null);
  const [search, setSearch] = useState('');

  const fetchConfig = () => qc.invalidateQueries({ queryKey: PROCESS_LASSO_CONFIG_KEY });

  const cpuSets = config?.ProcessDefaults?.CPUSets ?? [];
  const ioPriorities = config?.ProcessDefaults?.DefaultIOPriorities ?? [];
  const cpuPriorities = config?.ProcessDefaults?.DefaultPriorities ?? [];
  const performanceModeExes = config?.GamingMode?.AutomaticGamingModeProcessPaths ?? [];

  // Merge CPUSets, DefaultIOPriorities, DefaultPriorities, and
  // AutomaticGamingModeProcessPaths (four independent lists in Process
  // Lasso's own config) into one per-process view — a user thinks in terms
  // of "settings for this game", not four disconnected lists that happen to
  // share exe names. CPUSets' order is the primary order since it's the
  // most commonly-set field; entries only present in the other lists are
  // appended after.
  const priorityByExe = new Map(ioPriorities.map(r => [r.exe, r.priority] as const));
  const coresByExe = new Map(cpuSets.map(r => [r.exe, r.cores] as const));
  const cpuPriorityByExe = new Map(cpuPriorities.map(r => [r.exe, r.priority] as const));
  const performanceModeSet = new Set(performanceModeExes);
  const allExes = [...new Set([
    ...cpuSets.map(r => r.exe),
    ...ioPriorities.map(r => r.exe),
    ...cpuPriorities.map(r => r.exe),
    ...performanceModeExes,
  ])];
  const processRules: ProcessRule[] = allExes.map(exe => ({
    exe,
    cores: coresByExe.get(exe),
    priority: priorityByExe.get(exe),
    cpuPriority: cpuPriorityByExe.get(exe),
    performanceMode: performanceModeSet.has(exe) || undefined,
  }));

  const openAdd = () => {
    setSelectedProcess('');
    setSelectedCores([]);
    setSelectedPriority(null);
    setSelectedCpuPriority(null);
    setSelectedPerformanceMode(false);
    setEditingExe(null);
    setAddOpen(true);
  };

  const openEdit = (rule: ProcessRule) => {
    setSelectedProcess(rule.exe);
    setEditingExe(rule.exe);
    setSelectedCores(rule.cores ?? []);
    setSelectedPriority(rule.priority ?? null);
    setSelectedCpuPriority(rule.cpuPriority ?? null);
    setSelectedPerformanceMode(rule.performanceMode ?? false);
    setAddOpen(true);
  };

  const handleSave = async () => {
    const target = editingExe || selectedProcess;
    if (!target || (selectedCores.length === 0 && selectedPriority === null && selectedCpuPriority === null && !selectedPerformanceMode)) return;
    if (selectedCores.length > 0) await ProcessLassoApi.config.cpuSets.set(target, selectedCores);
    else if (editingExe) await ProcessLassoApi.config.cpuSets.remove(target);
    if (selectedPriority !== null) await ProcessLassoApi.config.ioPriorities.set(target, selectedPriority);
    else if (editingExe) await ProcessLassoApi.config.ioPriorities.remove(target);
    if (selectedCpuPriority !== null) await ProcessLassoApi.config.cpuPriorities.set(target, selectedCpuPriority);
    else if (editingExe) await ProcessLassoApi.config.cpuPriorities.remove(target);
    if (selectedPerformanceMode) await ProcessLassoApi.config.performanceMode.set(target);
    else if (editingExe) await ProcessLassoApi.config.performanceMode.remove(target);
    setAddOpen(false);
    setEditingExe(null);
    setSelectedProcess('');
    fetchConfig();
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    await ProcessLassoApi.config.cpuSets.remove(pendingDelete);
    await ProcessLassoApi.config.ioPriorities.remove(pendingDelete);
    await ProcessLassoApi.config.cpuPriorities.remove(pendingDelete);
    await ProcessLassoApi.config.performanceMode.remove(pendingDelete);
    setPendingDelete(null);
    setDeleteOpen(false);
    fetchConfig();
  };

  const startReorder = () => {
    setOrder(processRules.map(r => r.exe));
    setReordering(true);
  };

  const finishReorder = async () => {
    onDragEnd(); // safety net: clear any drag still in flight when Done is clicked
    setReordering(false);
    await Promise.all([
      ProcessLassoApi.config.cpuSets.reorder(order),
      ProcessLassoApi.config.ioPriorities.reorder(order),
      ProcessLassoApi.config.cpuPriorities.reorder(order),
    ]);
    fetchConfig();
  };

  // Window-level listeners rather than per-row onPointerMove/onPointerUp
  // props: dragging reorders `order`, which moves this row's DOM node to a
  // new position, and that can silently drop pointer capture mid-drag —
  // leaving the row's own handlers never called and the drag stuck forever.
  // Window listeners don't depend on the dragged element's position at all.
  const onDragMove = (e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    setDragDy({ exe: drag.exe, dy });

    const el = rowRefs.current[drag.exe];
    if (!el) return;
    const rowStep = el.offsetHeight + 4; // row height + gap
    const steps = Math.round(dy / rowStep);
    if (steps === 0) return;

    setOrder(prev => {
      const idx = prev.indexOf(drag.exe);
      const nextIdx = Math.min(prev.length - 1, Math.max(0, idx + steps));
      if (nextIdx === idx) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      next.splice(nextIdx, 0, drag.exe);
      return next;
    });
    drag.startY = e.clientY;
    setDragDy({ exe: drag.exe, dy: 0 });
  };

  const onDragEnd = () => {
    dragRef.current = null;
    setDragDy(null);
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
  };

  const onDragStart = (e: React.PointerEvent, exe: string) => {
    e.preventDefault();
    dragRef.current = { exe, startY: e.clientY };
    setDragDy({ exe, dy: 0 });
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  };

  // Search is hidden entirely during reordering (see below) rather than
  // applied to it — filtering a reordering list would desync the drag math
  // in onDragMove, which indexes into the full `order` array by visual row
  // position.
  const filteredRules = search.trim()
    ? processRules.filter(r => r.exe.toLowerCase().includes(search.trim().toLowerCase()))
    : processRules;

  const displayedRules = reordering
    ? order.map(exe => processRules.find(r => r.exe === exe)).filter((v): v is ProcessRule => !!v)
    : filteredRules;

  const toggleSelecting = () => {
    if (selecting) setSelectedExes(new Set());
    setActiveSelectPreset(null);
    setSelecting(!selecting);
  };

  const toggleExeSelected = (exe: string) => {
    setActiveSelectPreset(null); // manual edit — no longer "exactly preset X's matches"
    setSelectedExes(prev => {
      const next = new Set(prev);
      if (next.has(exe)) next.delete(exe); else next.add(exe);
      return next;
    });
  };

  const openBulkEdit = () => {
    setBulkApplyCores(false);
    setBulkCores([]);
    setBulkPriority(null);
    setBulkCpuPriority(null);
    setBulkApplyPerformanceMode(false);
    setBulkPerformanceMode(false);
    setBulkOpen(true);
  };

  // Selects every process rule whose CURRENT cores/priority happen to match
  // the preset's definition — inferred by value, not an explicit stored
  // link (see matchProcessRulePreset). Lets you e.g. select everything
  // that's effectively using "Game" today, to bulk-retarget it to a
  // different preset, or to re-apply "Game" after editing its definition.
  // Replaces the current selection (not additive) — clicking a different
  // preset shows exactly that preset's matches, not a running union.
  // Clicking the SAME preset again clears the selection (toggle off).
  const selectMatchingPreset = (preset: ProcessRulePreset) => {
    if (activeSelectPreset === preset.id) {
      setSelectedExes(new Set());
      setActiveSelectPreset(null);
      return;
    }
    const matching = processRules.filter(r => matchProcessRulePreset(r.cores, r.priority, [preset], r.cpuPriority, r.performanceMode));
    setSelectedExes(new Set(matching.map(r => r.exe)));
    setActiveSelectPreset(preset.id);
  };

  // "APPLY TO ALL MATCHING CONFIGS" in the preset edit form — re-applies the
  // preset's (just-updated) values to every process rule that matched its
  // OLD definition, so editing a preset doesn't leave already-applied rules
  // stuck on the stale values.
  const applyPresetToMatching = async (oldPreset: ProcessRulePreset, newPreset: ProcessRulePreset) => {
    const matchingExes = processRules
      .filter(r => matchProcessRulePreset(r.cores, r.priority, [oldPreset], r.cpuPriority, r.performanceMode))
      .map(r => r.exe);
    if (matchingExes.length === 0) return;
    // `?? null`/`?? false`, not the preset's raw (possibly-undefined) value —
    // bulkSet treats undefined as "leave untouched", so a field the preset no
    // longer specifies must be sent as an explicit clear or it'd stay stuck
    // at whatever it was before the preset was edited.
    await ProcessLassoApi.config.bulkSet(matchingExes, {
      cores: newPreset.cores ?? null,
      priority: newPreset.ioPriority ?? null,
      cpuPriority: newPreset.cpuPriority ?? null,
      performanceMode: newPreset.performanceMode ?? false,
    });
    fetchConfig();
  };

  const handleBulkSave = async () => {
    if (selectedExes.size === 0) return;
    if (!bulkApplyCores && bulkPriority === null && bulkCpuPriority === null && !bulkApplyPerformanceMode) return;
    await ProcessLassoApi.config.bulkSet(Array.from(selectedExes), {
      cores: bulkApplyCores ? bulkCores : undefined,
      priority: bulkPriority ?? undefined,
      cpuPriority: bulkCpuPriority ?? undefined,
      performanceMode: bulkApplyPerformanceMode ? bulkPerformanceMode : undefined,
    });
    setBulkOpen(false);
    setSelecting(false);
    setSelectedExes(new Set());
    fetchConfig();
  };

  if (!available) {
    return (
      <Box sx={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px',
        p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, textAlign: 'center',
      }}>
        <MemoryIcon sx={{ fontSize: 28, color: 'var(--text-dim)', mb: 1 }} />
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--warning)' }}>
          Process Lasso not found
        </Box>
        <Box sx={{ fontSize: '0.72rem', color: 'var(--text-dim)', maxWidth: 340 }}>
          Set its config folder in Settings → Tool Paths — it also needs to have been installed and run at least once to create its config file.
        </Box>
        <Box sx={{ mt: 0.5 }}><HelpLink anchor="processlasso" /></Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 3,
        borderBottom: cpuSets.length > 0 ? '1px solid var(--border)' : 'none',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <MemoryIcon sx={{ fontSize: 22, color: 'var(--text-secondary)' }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              {...helpProps('Process Lasso', 'Per-process rules — which CPU cores a program is allowed to run on, its I/O and CPU scheduling priority, and whether to induce Windows Game/Performance Mode for it. Applied via the Process Lasso tool, which must be installed and running.')}
              sx={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '1rem',
                letterSpacing: '0.05em',
              }}
            >
              PROCESS LASSO
            </Box>
            <Box sx={{ fontSize: '0.72rem', color: 'var(--text-dim)', mt: 0.25 }}>
              {processRules.length === 0
                ? 'No process rules configured'
                : search.trim() && !reordering
                  ? `${filteredRules.length} of ${processRules.length} matching`
                  : `${processRules.length} process rule${processRules.length !== 1 ? 's' : ''} configured`
              }
            </Box>
          </Box>
        </Box>

        {processRules.length > 0 && !reordering && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', px: 1.5, height: 38 }}>
            <SearchRoundedIcon sx={{ fontSize: 16, color: 'var(--text-dim)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by process name…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }}
            />
            {search && (
              <CloseIcon onClick={() => setSearch('')} sx={{ fontSize: 15, color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0, '&:hover': { color: 'var(--text-primary)' } }} />
            )}
          </Box>
        )}

        {canWrite && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Box
            onClick={() => setManagingPresets(true)}
            {...helpProps('Presets', 'Named bundles of cores/priority/perf-mode settings (e.g. "Game") you can apply to any process in one click, and re-apply to every process already using them after editing.')}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.6, px: 2, py: 1, borderRadius: '8px',
              border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.05em',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-dim)' },
            }}
          >
            <TuneIcon sx={{ fontSize: 15 }} />
            PRESETS
          </Box>
          {processRules.length > 1 && !selecting && (
            <Box
              onClick={reordering ? finishReorder : startReorder}
              {...helpProps('Reorder', "Change which rule wins when a process would otherwise match more than one — Process Lasso applies the first matching rule in list order.")}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.6,
                px: 2,
                py: 1,
                borderRadius: '8px',
                border: `1px solid ${reordering ? 'var(--accent)' : 'var(--border)'}`,
                color: reordering ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '0.78rem',
                letterSpacing: '0.05em',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                  backgroundColor: 'var(--accent-dim)',
                },
              }}
            >
              {reordering ? <CheckIcon sx={{ fontSize: 15 }} /> : <SwapVertIcon sx={{ fontSize: 15 }} />}
              {reordering ? 'DONE' : 'REORDER'}
            </Box>
          )}
          {processRules.length > 1 && !reordering && (
            <Box
              onClick={toggleSelecting}
              {...helpProps('Select', 'Pick multiple processes to edit or re-preset at once instead of one at a time — see BULK EDIT once you have a selection.')}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.6, px: 2, py: 1, borderRadius: '8px',
                border: `1px solid ${selecting ? 'var(--accent)' : 'var(--border)'}`,
                color: selecting ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer',
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.05em',
                transition: 'all 0.15s ease',
                '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-dim)' },
              }}
            >
              <ChecklistIcon sx={{ fontSize: 15 }} />
              {selecting ? 'CANCEL' : 'SELECT'}
            </Box>
          )}
          {selecting && selectedExes.size > 0 && (
            <Box
              onClick={openBulkEdit}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.6, px: 2, py: 1, borderRadius: '8px',
                border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer', backgroundColor: 'var(--accent-dim)',
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.05em',
              }}
            >
              <EditIcon sx={{ fontSize: 15 }} />
              BULK EDIT ({selectedExes.size})
            </Box>
          )}
          {!selecting && (
          <Box
            onClick={openAdd}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.6,
              px: 2,
              py: 1,
              borderRadius: '8px',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '0.78rem',
              letterSpacing: '0.05em',
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
                backgroundColor: 'var(--accent-dim)',
              },
            }}
          >
            <AddIcon sx={{ fontSize: 15 }} />
            ADD
          </Box>
          )}
        </Box>
        )}

        {selecting && presets.length > 0 && (
          <Box>
            <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', mb: 0.5 }}>Select all matching a preset:</Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
              {presets.map(p => {
                const active = activeSelectPreset === p.id;
                return (
                  <Box
                    key={p.id}
                    onClick={() => selectMatchingPreset(p)}
                    title={active ? 'Click again to clear selection' : undefined}
                    sx={{
                      px: 1.2, py: 0.5, borderRadius: '999px', cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      backgroundColor: active ? 'var(--accent-dim)' : 'transparent',
                      fontSize: '0.74rem', color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
                    }}
                  >
                    {p.label}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>

      {/* Inline process rule list */}
      {processRules.length > 0 && (
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {displayedRules.map((rule) => (
            <Box
              key={rule.exe}
              ref={(el: HTMLDivElement | null) => { rowRefs.current[rule.exe] = el; }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.75,
                px: 2,
                py: 1.25,
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid transparent',
                transition: dragDy?.exe === rule.exe ? 'none' : 'all 0.12s ease',
                transform: dragDy?.exe === rule.exe ? `translateY(${dragDy.dy}px)` : undefined,
                position: 'relative',
                zIndex: dragDy?.exe === rule.exe ? 2 : 1,
                boxShadow: dragDy?.exe === rule.exe ? '0 4px 16px rgba(0,0,0,0.4)' : 'none',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderColor: 'var(--border)',
                },
              }}
            >
              {selecting ? (
                <Checkbox
                  size="small"
                  checked={selectedExes.has(rule.exe)}
                  onChange={() => toggleExeSelected(rule.exe)}
                  sx={{ p: 0, color: 'var(--text-dim)', '&.Mui-checked': { color: 'var(--accent)' } }}
                />
              ) : reordering ? (
                <Box
                  onPointerDown={e => onDragStart(e, rule.exe)}
                  sx={{
                    width: 30, height: 30, borderRadius: '6px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-dim)', cursor: 'grab', touchAction: 'none',
                    '&:active': { cursor: 'grabbing' },
                  }}
                >
                  <DragIndicatorIcon sx={{ fontSize: 18 }} />
                </Box>
              ) : (
                <Box sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '6px',
                  backgroundColor: 'rgba(59,130,246,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <MemoryIcon sx={{ fontSize: 15, color: 'var(--accent)' }} />
                </Box>
              )}

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {rule.exe}
                </Box>
                <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', mt: 0.15, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {(() => {
                    const matched = matchProcessRulePreset(rule.cores, rule.priority, presets, rule.cpuPriority, rule.performanceMode);
                    return matched && (
                      <Box component="span" sx={{ color: 'var(--accent)', fontWeight: 600 }}>{matched.label}</Box>
                    );
                  })()}
                  {rule.cores && <span>{formatCoreRanges(rule.cores) ? `Cores ${formatCoreRanges(rule.cores)}` : 'No cores'}</span>}
                  {rule.priority !== undefined && (
                    <Box component="span" sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.4,
                      color: IO_PRIORITY_COLORS[rule.priority],
                    }}>
                      <SpeedIcon sx={{ fontSize: 11 }} />
                      {IO_PRIORITY_LABELS[rule.priority]} I/O
                    </Box>
                  )}
                  {rule.cpuPriority !== undefined && (
                    <Box component="span" sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.4,
                      color: CPU_PRIORITY_COLORS[rule.cpuPriority],
                    }}>
                      <MemoryIcon sx={{ fontSize: 11 }} />
                      {CPU_PRIORITY_LABELS[rule.cpuPriority]} CPU
                    </Box>
                  )}
                  {rule.performanceMode && (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, color: 'var(--accent)' }}>
                      <SpeedIcon sx={{ fontSize: 11 }} />
                      Perf Mode
                    </Box>
                  )}
                </Box>
              </Box>

              {!reordering && !selecting && canWrite && (
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  <IconButton
                    size="small"
                    onClick={() => openEdit(rule)}
                    sx={{
                      color: 'var(--text-dim)',
                      '&:hover': { color: 'var(--accent)', backgroundColor: 'var(--accent-dim)' },
                    }}
                  >
                    <EditIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => { setPendingDelete(rule.exe); setDeleteOpen(true); }}
                    sx={{
                      color: 'var(--text-dim)',
                      '&:hover': { color: 'var(--error)', backgroundColor: 'var(--error-dim)' },
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditingExe(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingExe ? `Edit ${editingExe}` : 'Add Process Rule'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            {editingExe ? (
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {editingExe}
              </Box>
            ) : (
              <ProcessNameAutocomplete value={selectedProcess} onChange={setSelectedProcess} />
            )}
            <ProcessRulePicker
              coreCount={coreCount}
              value={selectedCores}
              onChange={setSelectedCores}
              presets={presets}
              onDeletePreset={deletePreset}
              onApplyIoPriority={setSelectedPriority}
              onApplyCpuPriority={setSelectedCpuPriority}
              onApplyPerformanceMode={setSelectedPerformanceMode}
              showManageLink={false}
              showSaveAsPresetLink={false}
            />
            <IoPrioritySelector value={selectedPriority} onChange={setSelectedPriority} />
            <CpuPrioritySelector value={selectedCpuPriority} onChange={setSelectedCpuPriority} />
            <Box
              onClick={() => setSelectedPerformanceMode(!selectedPerformanceMode)}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, cursor: 'pointer' }}
            >
              <Box
                {...helpProps('Induce Performance Mode', "Tells Process Lasso to treat this process like a game — deprioritizing background/system tasks and applying Windows Game Mode-style optimizations while it's running, even for programs Process Lasso wouldn't normally auto-detect as a game.")}
                sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: selectedPerformanceMode ? 'var(--text-primary)' : 'var(--text-dim)' }}
              >
                INDUCE PERFORMANCE MODE
              </Box>
              <ToggleSwitch checked={selectedPerformanceMode} onChange={() => setSelectedPerformanceMode(!selectedPerformanceMode)} size="sm" />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddOpen(false); setEditingExe(null); }} sx={{ color: 'var(--text-secondary)' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={(!selectedProcess && !editingExe) || (selectedCores.length === 0 && selectedPriority === null && selectedCpuPriority === null && !selectedPerformanceMode)}
            sx={{ color: 'var(--accent)' }}
          >
            {editingExe ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk edit dialog */}
      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Edit {selectedExes.size} Process{selectedExes.size !== 1 ? 'es' : ''}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <Box sx={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              Applies to: <Box component="span" sx={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{Array.from(selectedExes).join(', ')}</Box>
            </Box>
            {presets.length > 0 && (
              <Box>
                <FormLabel>APPLY PRESET</FormLabel>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 0.5 }}>
                  {presets.map(p => (
                    <Box
                      key={p.id}
                      onClick={() => {
                        if (p.cores) { setBulkApplyCores(true); setBulkCores([...p.cores].sort((a, b) => a - b)); }
                        if (p.ioPriority !== undefined) setBulkPriority(p.ioPriority);
                        if (p.cpuPriority !== undefined) setBulkCpuPriority(p.cpuPriority);
                        if (p.performanceMode !== undefined) { setBulkApplyPerformanceMode(true); setBulkPerformanceMode(p.performanceMode); }
                      }}
                      title={presetSubLabel(p) ?? undefined}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5, px: 1.2, py: 0.5,
                        borderRadius: '999px', border: '1px solid var(--border)', cursor: 'pointer',
                        fontSize: '0.74rem', color: 'var(--text-secondary)',
                        '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
                      }}
                    >
                      {p.label}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: bulkApplyCores ? 1.5 : 0 }}>
                <Checkbox
                  size="small"
                  checked={bulkApplyCores}
                  onChange={e => setBulkApplyCores(e.target.checked)}
                  sx={{ p: 0, color: 'var(--text-dim)', '&.Mui-checked': { color: 'var(--accent)' } }}
                />
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)' }}>
                  SET CPU CORES FOR ALL SELECTED
                </Box>
              </Box>
              {bulkApplyCores && (
                <ProcessRulePicker
                  coreCount={coreCount}
                  value={bulkCores}
                  onChange={setBulkCores}
                  presets={[]}
                  showManageLink={false}
                  showSaveAsPresetLink={false}
                />
              )}
            </Box>
            <IoPrioritySelector value={bulkPriority} onChange={setBulkPriority} />
            <CpuPrioritySelector value={bulkCpuPriority} onChange={setBulkCpuPriority} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Checkbox
                  size="small"
                  checked={bulkApplyPerformanceMode}
                  onChange={e => { setBulkApplyPerformanceMode(e.target.checked); setBulkPerformanceMode(e.target.checked); }}
                  sx={{ p: 0, color: 'var(--text-dim)', '&.Mui-checked': { color: 'var(--accent)' } }}
                />
                <Box
                  {...helpProps('Induce Performance Mode', "Tells Process Lasso to treat these processes like games — deprioritizing background/system tasks and applying Windows Game Mode-style optimizations while they're running.")}
                  sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)' }}
                >
                  SET INDUCE PERFORMANCE MODE FOR ALL SELECTED
                </Box>
              </Box>
              {bulkApplyPerformanceMode && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1, pl: 3.5 }}>
                  <Box sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{bulkPerformanceMode ? 'Enable' : 'Disable'}</Box>
                  <ToggleSwitch checked={bulkPerformanceMode} onChange={() => setBulkPerformanceMode(!bulkPerformanceMode)} size="sm" />
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)} sx={{ color: 'var(--text-secondary)' }}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkSave}
            disabled={!bulkApplyCores && bulkPriority === null && bulkCpuPriority === null && !bulkApplyPerformanceMode}
            sx={{ color: 'var(--accent)' }}
          >
            Apply to {selectedExes.size}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Box sx={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Remove process rule for{' '}
            <Box component="span" sx={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {pendingDelete}
            </Box>
            ?
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} sx={{ color: 'var(--text-secondary)' }}>Cancel</Button>
          <Button onClick={handleDelete} sx={{ color: 'var(--error)' }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {managingPresets && (
        <ManagePresetsDialog presets={presets} coreCount={coreCount} onSavePreset={savePreset} onDeletePreset={deletePreset} onApplyToMatching={applyPresetToMatching} onClose={() => setManagingPresets(false)} />
      )}
    </Box>
  );
};
