'use client';

import { useState } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TvIcon from '@mui/icons-material/Tv';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import DevicesIcon from '@mui/icons-material/Devices';
import StayPrimaryPortraitIcon from '@mui/icons-material/StayPrimaryPortrait';
import MonitorIcon from '@mui/icons-material/Monitor';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import HdrOnIcon from '@mui/icons-material/HdrOn';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSwitchDisplayProfile } from '@/hooks/displays/useSwitchDisplayProfile';
import { useDisplayProfiles } from '@/hooks/config/useAppConfig';
import { useCaptureDisplayProfile, useDeleteDisplayProfile, useRenameDisplayProfile, useReorderDisplayProfiles, useUpdateDisplayProfile } from '@/hooks/displays/useDisplayProfileMutations';
import { SvgIconComponent } from '@mui/icons-material';
import { SelectableCard } from '@/components/ui/SelectableCard';
import { ModalShell } from '@/components/ui/ModalShell';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { DialogButtons } from '@/components/ui/DialogButtons';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { FormLabel } from '@/components/ui/FormLabel';
import { fieldStyle } from '@/components/ui/fieldStyle';
import { useGrants } from '@/hooks/auth/useGrants';
import { DisplayApi } from '@/app/api/display/api';
import { helpProps } from '@/components/help/HelpModeContext';
import type { DisplayDetail, DisplayProfileSummary } from '@/app/api/display/api';

function iconForProfile(name: string): SvgIconComponent {
  const n = name.toLowerCase();
  if (n.includes('portrait')) return StayPrimaryPortraitIcon;
  if (n.includes('multi') || n.includes('dual') || n.includes('triple')) return DevicesIcon;
  if (n.includes('tv') || n.includes('lounge') || n.includes('couch')) return TvIcon;
  if (n.includes('office') || n.includes('desk') || n.includes('work')) return DesktopWindowsIcon;
  return MonitorIcon;
}

function CaptureDialog({ onClose }: { onClose: () => void }) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: capture, isPending } = useCaptureDisplayProfile();

  async function handleSave() {
    if (!label.trim()) return;
    setError(null);
    try {
      await capture({ label: label.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Capture failed');
    }
  }

  return (
    <ModalShell onClose={onClose} maxWidth={380}>
      <DialogHeader title="CAPTURE CURRENT SETUP" onClose={onClose} />
      <Box sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Arrange your monitors how you want them first, then save that layout as a profile you can switch back to later.
      </Box>
      <Box>
        <FormLabel>PROFILE NAME</FormLabel>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Lounge" style={fieldStyle} spellCheck={false} autoFocus />
      </Box>
      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
      <DialogButtons onCancel={onClose} onConfirm={handleSave} confirmLabel={isPending ? 'SAVING…' : 'SAVE'} confirmDisabled={!label.trim() || isPending} />
    </ModalShell>
  );
}

function DisplayDetailBody({ data, isLoading, isError, emptyMessage }: { data?: DisplayDetail[]; isLoading: boolean; isError: boolean; emptyMessage: string }) {
  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} sx={{ color: 'var(--accent)' }} /></Box>;
  if (isError) return <Alert severity="error" sx={{ borderRadius: 2 }}>Couldn't read display info</Alert>;
  if (!data || data.length === 0) return <Box sx={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', py: 2 }}>{emptyMessage}</Box>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {data.map(d => (
        <Box key={d.targetId} sx={{ border: '1px solid var(--border)', borderRadius: '10px', p: 1.5, backgroundColor: 'var(--bg-elevated)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{d.name}</Box>
            {d.hdrSupported && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, color: d.hdrEnabled ? 'var(--success)' : 'var(--text-dim)' }}>
                <HdrOnIcon sx={{ fontSize: 15 }} />
                <Box sx={{ fontSize: '0.62rem', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {d.hdrEnabled ? 'HDR ON' : 'HDR OFF'}
                </Box>
              </Box>
            )}
          </Box>
          <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', mt: 0.5 }}>
            {d.connection} · {d.width}×{d.height} @ {d.refreshRate}Hz
          </Box>
          <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', mt: 0.25 }}>
            {d.rotation}{d.bitsPerColorChannel ? ` · ${d.bitsPerColorChannel}-bit color` : ''}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function DisplayInfoDialog({ onClose, profile }: { onClose: () => void; profile: DisplayProfileSummary }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['display-profile-details', profile.id],
    queryFn: () => DisplayApi.getProfileDetails(profile.id),
  });

  return (
    <ModalShell onClose={onClose} maxWidth={420}>
      <DialogHeader title={`${profile.label.toUpperCase()} — DISPLAYS`} onClose={onClose} />
      <DisplayDetailBody data={data} isLoading={isLoading} isError={isError} emptyMessage="This profile has no displays stored" />
    </ModalShell>
  );
}

function CurrentDisplaysSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['display-live-details'],
    queryFn: DisplayApi.getDetails,
    refetchOnWindowFocus: true,
  });

  return (
    <Box>
      <FormLabel help="Monitors detected right now, read live via Windows' own display API — not a saved profile. Use CAPTURE CURRENT SETUP below to save this arrangement so you can switch back to it later.">CURRENT DISPLAYS</FormLabel>
      <DisplayDetailBody data={data} isLoading={isLoading} isError={isError} emptyMessage="No active displays detected" />
    </Box>
  );
}

function EditProfileDialog({ profile, onClose, onDeleteRequested }: { profile: DisplayProfileSummary; onClose: () => void; onDeleteRequested: () => void }) {
  const [label, setLabel] = useState(profile.label);
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: rename, isPending: renaming } = useRenameDisplayProfile();
  const { mutateAsync: update, isPending: updating } = useUpdateDisplayProfile();
  const qc = useQueryClient();

  async function handleSave() {
    if (!label.trim() || label.trim() === profile.label) { onClose(); return; }
    setError(null);
    try {
      await rename({ id: profile.id, label: label.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed');
    }
  }

  async function handleUpdate() {
    setError(null);
    try {
      await update({ id: profile.id });
      qc.invalidateQueries({ queryKey: ['display-active-profile'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  return (
    <ModalShell onClose={onClose} maxWidth={380}>
      <DialogHeader title="EDIT PROFILE" onClose={onClose} />
      <Box>
        <FormLabel>PROFILE NAME</FormLabel>
        <input value={label} onChange={e => setLabel(e.target.value)} style={fieldStyle} spellCheck={false} autoFocus />
      </Box>
      <Box
        onClick={updating ? undefined : handleUpdate}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.1, borderRadius: '10px',
          border: '1px solid var(--border)', cursor: updating ? 'default' : 'pointer', color: 'var(--text-secondary)',
          '&:hover': updating ? undefined : { borderColor: 'var(--accent)', color: 'var(--accent)' },
        }}
      >
        {updating ? <CircularProgress size={15} sx={{ color: 'var(--accent)' }} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.76rem', letterSpacing: '0.04em' }}>
          {updating ? 'UPDATING…' : 'UPDATE WITH CURRENT SETUP'}
        </Box>
      </Box>
      <Box
        onClick={onDeleteRequested}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.1, borderRadius: '10px',
          border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--error)',
          '&:hover': { borderColor: 'var(--error)', backgroundColor: 'rgba(239,68,68,0.08)' },
        }}
      >
        <DeleteIcon sx={{ fontSize: 16 }} />
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.76rem', letterSpacing: '0.04em' }}>DELETE</Box>
      </Box>
      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
      <DialogButtons onCancel={onClose} onConfirm={handleSave} confirmLabel={renaming ? 'SAVING…' : 'SAVE'} confirmDisabled={!label.trim() || renaming} />
    </ModalShell>
  );
}

function SortableProfileRow({
  profile, isActive, isLoading, disabled, canWrite, editMode, onSwitch, onInfo, onEdit,
}: {
  profile: DisplayProfileSummary;
  isActive: boolean;
  isLoading: boolean;
  disabled: boolean;
  canWrite: boolean;
  editMode: boolean;
  onSwitch: () => void;
  onInfo: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: profile.id });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : 'auto',
        position: 'relative',
      }}
    >
      {canWrite && editMode && (
        <Box
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, flexShrink: 0,
            color: 'var(--text-dim)', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none',
            '&:hover': { color: 'var(--accent)' },
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 18 }} />
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <SelectableCard
          label={profile.label}
          icon={iconForProfile(profile.label)}
          isActive={isActive}
          isLoading={isLoading}
          disabled={disabled}
          lockedReason={canWrite ? undefined : "You don't have permission to switch displays"}
          onClick={onSwitch}
        />
      </Box>
      {editMode && (
        <Box
          onClick={onInfo}
          title={`${profile.label} display info`}
          sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-dim)', '&:hover': { color: 'var(--accent)', backgroundColor: 'rgba(59,130,246,0.1)' } }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
        </Box>
      )}
      {canWrite && editMode && (
        <Box
          onClick={onEdit}
          title={`Edit ${profile.label}`}
          sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-dim)', '&:hover': { color: 'var(--accent)', backgroundColor: 'rgba(59,130,246,0.1)' } }}
        >
          <EditOutlinedIcon sx={{ fontSize: 16 }} />
        </Box>
      )}
    </Box>
  );
}

export const DisplayControl = () => {
  const qc = useQueryClient();
  const { mutateAsync: switchDisplay } = useSwitchDisplayProfile();
  const { mutateAsync: deleteProfile } = useDeleteDisplayProfile();
  const { mutate: reorderProfiles } = useReorderDisplayProfiles();
  const { data: profiles = [], isLoading } = useDisplayProfiles();
  const { data: detectedActiveId } = useQuery({
    queryKey: ['display-active-profile'],
    queryFn: DisplayApi.getActiveProfileId,
    refetchOnWindowFocus: true,
  });
  const { has } = useGrants();
  const canWrite = has('displayoutput:write');
  const [loading, setLoading] = useState<string | null>(null);
  const [clickedActive, setClickedActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DisplayProfileSummary | null>(null);
  const [retryTarget, setRetryTarget] = useState<DisplayProfileSummary | null>(null);
  const [infoTarget, setInfoTarget] = useState<DisplayProfileSummary | null>(null);
  const [editTarget, setEditTarget] = useState<DisplayProfileSummary | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // A switch clicked this session is the most up-to-date signal; otherwise
  // fall back to the fingerprint match against whatever's live right now
  // (survives a refresh, unlike client-only state).
  const activeProfileId = clickedActive ?? detectedActiveId ?? null;

  const handleSwitch = async (p: DisplayProfileSummary, allowChanges = false) => {
    setError(null);
    setLoading(p.id);
    try {
      const data = await switchDisplay({ profile: p.id, allowChanges });
      if (data.ok) {
        setClickedActive(p.id);
        qc.invalidateQueries({ queryKey: ['display-active-profile'] });
        qc.invalidateQueries({ queryKey: ['display-live-details'] });
      } else if (data.canRetryWithChanges) {
        setRetryTarget(p);
      } else {
        setError(data.message || 'Switch failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(null);
    }
  };

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteProfile(deleteTarget.id);
    setDeleteTarget(null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIndex = profiles.findIndex(p => p.id === active.id);
    const newIndex = profiles.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...profiles];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    reorderProfiles(reordered.map(p => p.id));
  }

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} sx={{ color: 'var(--accent)' }} /></Box>;
  }

  const isAnyLoading = loading !== null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <CurrentDisplaysSection />

      {canWrite && profiles.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Box
            onClick={() => setEditMode(e => !e)}
            {...helpProps('Edit', 'Reorder saved display profiles by drag, or open one to rename, delete, or update it to match your current monitor setup.')}
            sx={{
              px: 1.5, py: 0.5, borderRadius: '7px', border: '1px solid var(--border)', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.05em',
              color: editMode ? 'var(--accent)' : 'var(--text-dim)',
              backgroundColor: editMode ? 'rgba(59,130,246,0.1)' : 'transparent',
              '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
            }}
          >
            {editMode ? 'DONE' : 'EDIT'}
          </Box>
        </Box>
      )}

      {profiles.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No display profiles yet — arrange your monitors how you want them, then capture that setup below.
        </Alert>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={profiles.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {profiles.map(p => (
                <SortableProfileRow
                  key={p.id}
                  profile={p}
                  isActive={activeProfileId === p.id}
                  isLoading={loading === p.id}
                  disabled={isAnyLoading || editMode}
                  canWrite={canWrite}
                  editMode={editMode}
                  onSwitch={() => handleSwitch(p)}
                  onInfo={() => setInfoTarget(p)}
                  onEdit={() => setEditTarget(p)}
                />
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      )}

      {error && <Alert severity="error" sx={{ mt: 0.5 }}>{error}</Alert>}

      {canWrite && (
        <Box
          onClick={() => setCapturing(true)}
          {...helpProps('Capture Current Setup', "Saves how your monitors are arranged right now (which is on, resolution, refresh rate, position, HDR) as a named profile you can switch back to in one tap later.")}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, mt: 0.5,
            px: 2, py: 1.1, borderRadius: '10px', border: '1px dashed var(--border)',
            color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)',
            fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.05em',
            '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-dim)' },
          }}
        >
          <AddIcon sx={{ fontSize: 16 }} /> CAPTURE CURRENT SETUP
        </Box>
      )}

      {capturing && <CaptureDialog onClose={() => setCapturing(false)} />}
      {infoTarget && <DisplayInfoDialog profile={infoTarget} onClose={() => setInfoTarget(null)} />}
      {editTarget && (
        <EditProfileDialog
          profile={editTarget}
          onClose={() => setEditTarget(null)}
          onDeleteRequested={() => { setDeleteTarget(editTarget); setEditTarget(null); }}
        />
      )}
      {retryTarget && (
        <ModalShell onClose={() => setRetryTarget(null)} maxWidth={380}>
          <DialogHeader title="COULDN'T APPLY EXACTLY AS SAVED" onClose={() => setRetryTarget(null)} />
          <Box sx={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <Box component="span" sx={{ color: 'var(--text-primary)' }}>{retryTarget.label}</Box> has changed slightly since it was saved — this can happen after a reboot or graphics driver update. Windows may still be able to use it, but might need to adjust a small detail (like the exact refresh rate) to make it fit. Your monitors and their arrangement should still come out the same.
          </Box>
          <DialogButtons
            onCancel={() => setRetryTarget(null)}
            onConfirm={() => { const p = retryTarget; setRetryTarget(null); handleSwitch(p, true); }}
            confirmLabel="APPLY ANYWAY"
          />
        </ModalShell>
      )}
      {deleteTarget && (
        <DeleteConfirmDialog
          title="Delete Display Profile"
          message={<>Remove <Box component="span" sx={{ color: 'var(--text-primary)' }}>{deleteTarget.label}</Box>? This can't be undone.</>}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Box>
  );
};
