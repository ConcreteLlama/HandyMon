'use client';

import { useState } from 'react';
import { Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ProcessRulePreset } from '@/types/app-config';
import { CpuPriorityLevel, IoPriorityLevel, IO_PRIORITY_LABELS, CPU_PRIORITY_LABELS } from '@/utils/proces-lasso/process-lasso';
import { fieldStyle } from './fieldStyle';
import { FormLabel } from './FormLabel';
import { ModalShell } from './ModalShell';
import { DialogHeader } from './DialogHeader';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { IoPrioritySelector } from './IoPrioritySelector';
import { CpuPrioritySelector } from './CpuPrioritySelector';
import { ToggleSwitch } from './ToggleSwitch';

type SavePresetFn = (
  label: string,
  cores?: number[],
  ioPriority?: IoPriorityLevel,
  editId?: string,
  cpuPriority?: CpuPriorityLevel,
  performanceMode?: boolean,
) => void;

export function presetSubLabel(p: ProcessRulePreset): string | null {
  const parts: string[] = [];
  if (p.cores && p.cores.length > 0) parts.push(`${p.cores.length} core${p.cores.length !== 1 ? 's' : ''}`);
  if (p.ioPriority !== undefined) parts.push(`${IO_PRIORITY_LABELS[p.ioPriority]} I/O`);
  if (p.cpuPriority !== undefined) parts.push(`${CPU_PRIORITY_LABELS[p.cpuPriority]} CPU`);
  if (p.performanceMode) parts.push('Perf Mode');
  return parts.length > 0 ? parts.join(' · ') : null;
}

// Shared add/edit form — a preset is name + optional cores + optional
// priority, saved explicitly (not via ProcessRulePicker's own "save as
// preset" flow, which only knows about cores).
function PresetForm({ coreCount, initial, showApplyToMatching, onSave, onCancel }: {
  coreCount: number;
  initial?: ProcessRulePreset;
  // Only meaningful (and only rendered) when the caller can actually act on
  // it — see ManagePresetsDialog's onApplyToMatching.
  showApplyToMatching?: boolean;
  onSave: (label: string, cores?: number[], ioPriority?: IoPriorityLevel, cpuPriority?: CpuPriorityLevel, performanceMode?: boolean, applyToMatching?: boolean) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [cores, setCores] = useState<number[]>(initial?.cores ?? []);
  const [applyCores, setApplyCores] = useState((initial?.cores?.length ?? 0) > 0);
  const [priority, setPriority] = useState<IoPriorityLevel | null>(initial?.ioPriority ?? null);
  const [cpuPriority, setCpuPriority] = useState<CpuPriorityLevel | null>(initial?.cpuPriority ?? null);
  const [performanceMode, setPerformanceMode] = useState(initial?.performanceMode ?? false);
  const [applyToMatching, setApplyToMatching] = useState(false);

  const canSave = label.trim().length > 0 && (applyCores && cores.length > 0 || priority !== null || cpuPriority !== null || performanceMode);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <input
        autoFocus
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Preset name…"
        style={fieldStyle}
      />
      <Box>
        <Box
          onClick={() => setApplyCores(!applyCores)}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, cursor: 'pointer', mb: applyCores ? 1 : 0 }}
        >
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', color: applyCores ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            INCLUDES CPU CORES
          </Box>
          <ToggleSwitch checked={applyCores} onChange={() => setApplyCores(!applyCores)} size="sm" />
        </Box>
        {applyCores && (
          <ProcessRulePicker
            coreCount={coreCount}
            value={cores}
            onChange={setCores}
            presets={[]}
            showManageLink={false}
            showSaveAsPresetLink={false}
          />
        )}
      </Box>
      <IoPrioritySelector value={priority} onChange={setPriority} />
      <CpuPrioritySelector value={cpuPriority} onChange={setCpuPriority} />
      <Box
        onClick={() => setPerformanceMode(!performanceMode)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, cursor: 'pointer' }}
      >
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', color: performanceMode ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          INDUCE PERFORMANCE MODE
        </Box>
        <ToggleSwitch checked={performanceMode} onChange={() => setPerformanceMode(!performanceMode)} size="sm" />
      </Box>
      {initial && showApplyToMatching && (
        <Box
          onClick={() => setApplyToMatching(!applyToMatching)}
          title="Re-applies this preset's (now-updated) values to every process rule that currently matches its old definition"
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, cursor: 'pointer', pt: 1, borderTop: '1px solid var(--border)' }}
        >
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', color: applyToMatching ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            APPLY TO ALL MATCHING CONFIGS
          </Box>
          <ToggleSwitch checked={applyToMatching} onChange={() => setApplyToMatching(!applyToMatching)} size="sm" />
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Box onClick={onCancel} sx={{ px: 1.5, py: 0.6, borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', '&:hover': { backgroundColor: 'var(--border)' } }}>
          CANCEL
        </Box>
        <Box
          onClick={() => canSave && onSave(label.trim(), applyCores ? cores : undefined, priority ?? undefined, cpuPriority ?? undefined, performanceMode, applyToMatching)}
          sx={{
            px: 1.5, py: 0.6, borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
            color: canSave ? 'var(--accent)' : 'var(--text-dim)', cursor: canSave ? 'pointer' : 'default',
            '&:hover': canSave ? { backgroundColor: 'var(--accent-dim)' } : undefined,
          }}
        >
          SAVE
        </Box>
      </Box>
    </Box>
  );
}

// Presets are applied by tapping the chip directly, so deleting needs to
// live somewhere else — an inline delete icon on the same chip is too easy
// to hit by accident when reaching for the chip itself.
export function ManagePresetsDialog({ presets, coreCount, onSavePreset, onDeletePreset, onApplyToMatching, onClose }: {
  presets: ProcessRulePreset[];
  coreCount: number;
  onSavePreset?: SavePresetFn;
  onDeletePreset: (id: string) => void;
  // Re-applies the (just-updated) preset's values to every process rule that
  // matched its OLD definition — the "APPLY TO ALL MATCHING CONFIGS"
  // checkbox in PresetForm. Only meaningful where the caller can actually
  // see live process rules (ProcessLassoSection); omitted elsewhere (e.g.
  // the Processes tab's cores-only CpuSetAssign reuse of this dialog).
  onApplyToMatching?: (oldPreset: ProcessRulePreset, newPreset: ProcessRulePreset) => void;
  onClose: () => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<ProcessRulePreset | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ProcessRulePreset | null>(null);

  // Editing/adding shows ONLY the form — the rest of the preset list is
  // irrelevant once you've committed to one, and previously kept the list
  // (and its own edit buttons) visible below/above the form, which made the
  // form easy to miss entirely for presets high up the list (looked like
  // clicking edit "did nothing" when it just rendered off-screen).
  if (editingPreset || adding) {
    return (
      <ModalShell onClose={onClose} maxWidth={380}>
        <DialogHeader
          title={editingPreset ? `EDIT ${editingPreset.label.toUpperCase()}` : 'ADD PRESET'}
          onClose={onClose}
          startAdornment={
            <Box
              onClick={() => { setEditingPreset(null); setAdding(false); }}
              sx={{ display: 'flex', cursor: 'pointer', color: 'var(--text-dim)', '&:hover': { color: 'var(--accent)' } }}
            >
              <ArrowBackIcon sx={{ fontSize: 18 }} />
            </Box>
          }
        />
        <PresetForm
          coreCount={coreCount}
          initial={editingPreset ?? undefined}
          showApplyToMatching={!!onApplyToMatching}
          onSave={(label, cores, ioPriority, cpuPriority, performanceMode, applyToMatching) => {
            onSavePreset!(label, cores, ioPriority, editingPreset?.id, cpuPriority, performanceMode);
            if (applyToMatching && editingPreset && onApplyToMatching) {
              onApplyToMatching(editingPreset, { ...editingPreset, label, cores, ioPriority, cpuPriority, performanceMode });
            }
            setEditingPreset(null);
            setAdding(false);
          }}
          onCancel={() => { setEditingPreset(null); setAdding(false); }}
        />
      </ModalShell>
    );
  }

  return (
    <>
      <ModalShell onClose={onClose} maxWidth={380}>
        <DialogHeader title="MANAGE PRESETS" onClose={onClose} />
        {presets.length === 0 ? (
          <Box sx={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', py: 2 }}>No presets saved</Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {presets.map(p => (
              <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.2, py: 0.9, borderRadius: '8px', border: '1px solid var(--border)' }}>
                <Box onClick={() => onSavePreset && setEditingPreset(p)} sx={{ minWidth: 0, cursor: onSavePreset ? 'pointer' : 'default' }}>
                  <Box sx={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{p.label}</Box>
                  {presetSubLabel(p) && <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', mt: 0.15 }}>{presetSubLabel(p)}</Box>}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                  {onSavePreset && (
                    <Box
                      onClick={() => setEditingPreset(p)}
                      title={`Edit ${p.label}`}
                      sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--accent)', backgroundColor: 'var(--accent-dim)' } }}
                    >
                      <EditIcon sx={{ fontSize: 15 }} />
                    </Box>
                  )}
                  <Box
                    onClick={() => setDeleteTarget(p)}
                    title={`Delete ${p.label}`}
                    sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--error)', backgroundColor: 'var(--error-dim)' } }}
                  >
                    <CloseIcon sx={{ fontSize: 15 }} />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {onSavePreset && (
          <Box
            onClick={() => setAdding(true)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, alignSelf: 'flex-start',
              fontSize: '0.74rem', color: 'var(--text-dim)', cursor: 'pointer',
              borderTop: presets.length > 0 ? '1px solid var(--border)' : 'none',
              pt: presets.length > 0 ? 1.5 : 0, width: '100%',
              '&:hover': { color: 'var(--accent)' },
            }}
          >
            <AddIcon sx={{ fontSize: 14 }} /> ADD PRESET
          </Box>
        )}
      </ModalShell>
      {deleteTarget && (
        <DeleteConfirmDialog
          title="Delete Preset"
          message={<>Remove <Box component="span" sx={{ color: 'var(--text-primary)' }}>{deleteTarget.label}</Box>? This can't be undone.</>}
          onConfirm={() => { onDeletePreset(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

type ProcessRulePickerProps = {
  coreCount: number;
  value: number[];
  onChange: (cores: number[]) => void;
  presets: ProcessRulePreset[];
  onSavePreset?: SavePresetFn;
  onDeletePreset?: (id: string) => void;
  // Fires when a clicked preset defines an I/O priority / CPU priority /
  // performance mode — callers that don't care (e.g. TaskSwitcherSection's
  // cores-only CpuSetAssign) simply omit these and get the pre-existing
  // cores-only behavior.
  onApplyIoPriority?: (priority: IoPriorityLevel) => void;
  onApplyCpuPriority?: (priority: CpuPriorityLevel) => void;
  onApplyPerformanceMode?: (enabled: boolean) => void;
  // Hide the inline MANAGE link when the caller already offers a dedicated,
  // top-level way to manage presets (e.g. ProcessLassoSection) — also avoids
  // nesting one ModalShell dialog inside another when this picker itself
  // already lives inside a modal.
  showManageLink?: boolean;
  // Hide the "SAVE AS PRESET" shortcut at the bottom — creating a preset
  // from whatever cores happen to be selected for a specific program/process
  // duplicates the Manage Presets dialog's own "ADD PRESET" flow, which is
  // meant to be the one place presets get created. Still defaults to true
  // for the dialog's own internal reuse of this component (see
  // ManagePresetsDialog below), which needs it to implement that flow.
  showSaveAsPresetLink?: boolean;
};

// Per-core checkbox grid, sized to whatever CPU it's running on (coreCount is
// read from os.cpus().length server-side, never hardcoded) — plus a row of
// user-saved presets (cores and/or I/O priority) that can be applied or removed.
export function ProcessRulePicker({ coreCount, value, onChange, presets, onSavePreset, onDeletePreset, onApplyIoPriority, onApplyCpuPriority, onApplyPerformanceMode, showManageLink = true, showSaveAsPresetLink = true }: ProcessRulePickerProps) {
  const [savingName, setSavingName] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [managing, setManaging] = useState(false);

  const toggle = (core: number) => {
    onChange(value.includes(core) ? value.filter(c => c !== core) : [...value, core].sort((a, b) => a - b));
  };

  const applyPreset = (p: ProcessRulePreset) => {
    if (p.cores) onChange([...p.cores].sort((a, b) => a - b));
    if (p.ioPriority !== undefined) onApplyIoPriority?.(p.ioPriority);
    if (p.cpuPriority !== undefined) onApplyCpuPriority?.(p.cpuPriority);
    if (p.performanceMode !== undefined) onApplyPerformanceMode?.(p.performanceMode);
  };

  const confirmSave = () => {
    const label = presetName.trim();
    if (!label || value.length === 0) return;
    onSavePreset?.(label, value);
    setPresetName('');
    setSavingName(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {presets.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <FormLabel>PRESETS</FormLabel>
            {showManageLink && onDeletePreset && (
              <Box onClick={() => setManaging(true)} sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', cursor: 'pointer', mb: 0.4, '&:hover': { color: 'var(--accent)' } }}>
                MANAGE
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
            {presets.map(p => (
              <Box
                key={p.id}
                onClick={() => applyPreset(p)}
                title={presetSubLabel(p) ?? undefined}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1.2, py: 0.5,
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
      {showManageLink && managing && onDeletePreset && (
        <ManagePresetsDialog presets={presets} coreCount={coreCount} onSavePreset={onSavePreset} onDeletePreset={onDeletePreset} onClose={() => setManaging(false)} />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <FormLabel helpTitle="CPU Cores" help="Restricts this process to only run on the checked CPU cores (a Windows CPU affinity mask, applied via Process Lasso). Useful for keeping a background app off the cores your game/main app needs, or pinning something to specific cores for consistent scheduling.">{`CORES (${value.length} of ${coreCount})`}</FormLabel>
        <Box sx={{ display: 'flex', gap: 1.25 }}>
          <Box onClick={() => onChange(Array.from({ length: coreCount }, (_, i) => i))} sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--accent)' } }}>ALL</Box>
          <Box onClick={() => onChange([])} sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--accent)' } }}>NONE</Box>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {Array.from({ length: coreCount }, (_, core) => {
          const active = value.includes(core);
          return (
            <Box
              key={core}
              onClick={() => toggle(core)}
              sx={{
                width: 30, height: 26, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: '0.68rem', cursor: 'pointer', userSelect: 'none',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                backgroundColor: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-dim)',
                '&:hover': { borderColor: 'var(--accent)' },
              }}
            >
              {core}
            </Box>
          );
        })}
      </Box>

      {showSaveAsPresetLink && onSavePreset && (
        savingName ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <input
              autoFocus
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              placeholder="Preset name…"
              onKeyDown={e => { if (e.key === 'Enter') confirmSave(); if (e.key === 'Escape') { setSavingName(false); setPresetName(''); } }}
              style={{ ...fieldStyle, flex: 1 }}
            />
            <Box onClick={confirmSave} sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--accent)', cursor: 'pointer', '&:hover': { backgroundColor: 'var(--accent-dim)' } }}>
              <CheckIcon sx={{ fontSize: 16 }} />
            </Box>
            <Box onClick={() => { setSavingName(false); setPresetName(''); }} sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </Box>
          </Box>
        ) : (
          <Box
            onClick={() => value.length > 0 && setSavingName(true)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, alignSelf: 'flex-start',
              fontSize: '0.72rem', color: 'var(--text-dim)', cursor: value.length ? 'pointer' : 'default',
              opacity: value.length ? 1 : 0.4,
              '&:hover': value.length ? { color: 'var(--accent)' } : undefined,
            }}
          >
            <AddIcon sx={{ fontSize: 14 }} /> SAVE AS PRESET
          </Box>
        )
      )}
    </Box>
  );
}
