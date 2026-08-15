'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PairApi, PairedDevice, PairCodeResult } from '@/app/api/auth/pair-info/api';
import { usePairInfo } from '@/hooks/auth/usePairInfo';
import { tipProps } from '@/components/onboarding/tips';
import { PermissionsEditor } from '@/components/PermissionsEditor';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { DialogButtons } from '@/components/ui/DialogButtons';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { ModalShell } from '@/components/ui/ModalShell';
import { ALL_GRANTS, type Grant } from '@/types/grants';
import { helpProps } from '@/components/help/HelpModeContext';

function grantsSummary(grants?: string[]): string {
  if (!grants) return 'Full access';
  if (grants.length === 0) return 'No access';
  return `${grants.length} grant${grants.length !== 1 ? 's' : ''}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return 'Just now';
  if (hours < 1)  return `${mins}m ago`;
  if (days < 1)   return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Pair form (name + permissions, before the QR is generated) ────────────────

function PairFormDialog({ onGenerate, onClose, generating }: {
  onGenerate: (name: string, grants: Set<Grant>) => void; onClose: () => void; generating: boolean;
}) {
  const [name, setName] = useState('');
  const [grants, setGrants] = useState<Set<Grant>>(new Set(ALL_GRANTS));

  return (
    <ModalShell onClose={onClose}>
      <DialogHeader title="PAIR NEW DEVICE" onClose={onClose} />
      <Box sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, mt: -1 }}>
        Choose what this device can do, then generate its QR code.
      </Box>
      <PermissionsEditor name={name} onNameChange={setName} grants={grants} onGrantsChange={setGrants} />
      <DialogButtons onCancel={onClose} onConfirm={() => onGenerate(name, grants)} confirmLabel={generating ? 'GENERATING…' : 'GENERATE QR'} confirmDisabled={generating} />
    </ModalShell>
  );
}

// ── QR modal ──────────────────────────────────────────────────────────────────

function QrModal({ result, onClose }: { result: PairCodeResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  function copyUrl() {
    navigator.clipboard.writeText(result.pairUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ModalShell onClose={onClose} maxWidth={360}>
      <DialogHeader title="PAIR NEW DEVICE" onClose={onClose} />

      <Box sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Scan with your phone camera. This code pairs that device permanently — remove it from the list if you want to revoke access.
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ backgroundColor: '#ffffff', borderRadius: '10px', p: 1.5, lineHeight: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.qrDataUrl} alt="Pair QR code" style={{ width: 200, height: 200, display: 'block' }} />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', px: 1.25, py: 0.75, backgroundColor: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          {result.pairUrl}
        </Box>
        <Box onClick={copyUrl} sx={{ px: 1.5, py: 0.75, borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: copied ? 'rgba(52,211,153,0.08)' : 'var(--bg-elevated)', color: copied ? 'var(--success)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.05em', flexShrink: 0, transition: 'all 0.15s', '&:hover': { backgroundColor: 'var(--border)' } }}>
          {copied ? 'COPIED' : 'COPY'}
        </Box>
      </Box>
    </ModalShell>
  );
}

// ── Edit device dialog (name + permissions together) ──────────────────────────

function EditDeviceDialog({ device, onSave, onClose }: {
  device: PairedDevice; onSave: (updates: { name: string; grants: Set<Grant> }) => void; onClose: () => void;
}) {
  const [name, setName] = useState(device.name);
  const [grants, setGrants] = useState<Set<Grant>>(new Set((device.grants ?? ALL_GRANTS) as Grant[]));

  return (
    <ModalShell onClose={onClose}>
      <DialogHeader title="EDIT DEVICE" onClose={onClose} />
      <PermissionsEditor name={name} onNameChange={setName} grants={grants} onGrantsChange={setGrants} />
      <DialogButtons onCancel={onClose} onConfirm={() => onSave({ name: name.trim() || device.name, grants })} confirmLabel="SAVE" />
    </ModalShell>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PairSection() {
  const { data: isLocalhost } = usePairInfo(); // reuse hook just for localhost check
  const qc = useQueryClient();

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['paired-devices'],
    queryFn: PairApi.listDevices,
    enabled: true, // always try; returns 403 for non-localhost (we handle gracefully)
  });

  const deleteMutation = useMutation({
    mutationFn: PairApi.deleteDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paired-devices'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, grants }: { id: string; name: string; grants: Set<Grant> }) =>
      PairApi.updateDevice(id, { name, grants: grants.size === ALL_GRANTS.length ? null : [...grants] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paired-devices'] }),
  });

  const [qrResult, setQrResult] = useState<PairCodeResult | null>(null);
  const [pairFormOpen, setPairFormOpen] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [editTarget, setEditTarget] = useState<PairedDevice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PairedDevice | null>(null);

  // ?pair=1 is a one-shot trigger (FirstRunPairDialog's "Pair device now"
  // lands here via a full navigation, so it can't just call setPairFormOpen
  // directly) — open the form once, then strip the param so a later reload
  // of this same page doesn't keep reopening it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pair') === '1') {
      setPairFormOpen(true);
      params.delete('pair');
      const query = params.toString();
      window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
    }
  }, []);

  // Determine if we're on localhost by whether the devices API succeeded
  const [canManage, setCanManage] = useState(false);
  // Track once devices load successfully
  if (!canManage && devices.length >= 0 && !isLoading) {
    // If devices loaded (even empty array), we have localhost access
  }

  async function handleGenerate(name: string, grants: Set<Grant>) {
    setGeneratingQr(true);
    try {
      // Full-access selection stores as "no grants field" (back-compat default), not a huge explicit list
      const result = await PairApi.createPairCode(name || undefined, grants.size === ALL_GRANTS.length ? undefined : [...grants]);
      setPairFormOpen(false);
      setQrResult(result);
      qc.invalidateQueries({ queryKey: ['paired-devices'] });
    } finally {
      setGeneratingQr(false);
    }
  }

  return (
    <>
      <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', backgroundColor: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <QrCode2Icon sx={{ fontSize: 20, color: 'var(--accent)' }} />
            </Box>
            <Box>
              <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>PAIRED DEVICES</Box>
              <Box sx={{ fontSize: '0.72rem', color: 'var(--text-secondary)', mt: 0.25 }}>Devices with access to this PC</Box>
            </Box>
          </Box>
          <Box onClick={() => setPairFormOpen(true)} {...tipProps('settings-pair')} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.65, borderRadius: 7, backgroundColor: 'var(--accent)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', flexShrink: 0, '&:hover': { backgroundColor: 'rgba(59,130,246,0.85)' }, transition: 'background 0.15s' }}>
            <AddIcon sx={{ fontSize: 15 }} />
            PAIR
          </Box>
        </Box>

        {/* Device list */}
        {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={18} sx={{ color: 'var(--accent)' }} /></Box>}

        {!isLoading && devices.length === 0 && (
          <Box sx={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', py: 1 }}>
            No devices paired yet
          </Box>
        )}

        {devices.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {devices.map(d => (
              <Box key={d.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, borderRadius: '9px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
                <PhoneAndroidIcon sx={{ fontSize: 18, color: 'var(--text-dim)', flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</Box>
                  <Box sx={{ fontSize: '0.66rem', color: 'var(--text-dim)', mt: 0.15 }}>
                    {d.lastSeen ? `Last seen ${timeAgo(d.lastSeen)}` : 'Never used'}
                    {' · '}
                    Paired {timeAgo(d.pairedAt)}
                    {' · '}
                    <Box
                      component="span"
                      {...helpProps('Grants', "How many permissions this device holds, out of everything HandyMon can gate (perf, actions, display, audio, fans, process control, and more). Tap the pencil to see and edit exactly which ones.")}
                    >
                      {grantsSummary(d.grants)}
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
                  <EditOutlinedIcon onClick={() => setEditTarget(d)} sx={{ fontSize: 16, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--accent)' } }} />
                  <DeleteOutlineIcon onClick={() => setDeleteTarget(d)} sx={{ fontSize: 16, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--error)' } }} />
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {pairFormOpen && (
        <PairFormDialog
          generating={generatingQr}
          onGenerate={handleGenerate}
          onClose={() => setPairFormOpen(false)}
        />
      )}
      {qrResult && <QrModal result={qrResult} onClose={() => setQrResult(null)} />}
      {editTarget && (
        <EditDeviceDialog
          device={editTarget}
          onSave={({ name, grants }) => { updateMutation.mutate({ id: editTarget.id, name, grants }); setEditTarget(null); }}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmDialog
          title="REMOVE DEVICE"
          message={<>Remove <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</strong>? It will lose access to this PC immediately.</>}
          confirmLabel="REMOVE"
          onConfirm={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
