'use client';

import { useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useAudioDevices } from '@/hooks/audio-devices/useAudioDevices';
import { AppConfig, ConfiguredAudioDevice } from '@/types/app-config';
import { toKebabId } from '@/utils/id';
import { fieldStyle } from '@/components/ui/fieldStyle';
import { FormLabel } from '@/components/ui/FormLabel';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { DialogButtons } from '@/components/ui/DialogButtons';
import { ModalShell } from '@/components/ui/ModalShell';

const emptyDevice = (): ConfiguredAudioDevice => ({ id: '', name: '', matchValue: '' });

function DeviceDialog({ device, onSave, onClose }: {
  device: ConfiguredAudioDevice;
  onSave: (d: ConfiguredAudioDevice) => void;
  onClose: () => void;
}) {
  const { data: audioDevicesData } = useAudioDevices();
  const liveDevices = audioDevicesData?.available ?? [];
  const [form, setForm] = useState<ConfiguredAudioDevice>({ ...device });
  const isNew = !device.id;
  const valid = form.name.trim() && form.matchValue.trim();

  function pickLiveDevice(deviceId: string) {
    const d = liveDevices.find(d => d.id === deviceId);
    if (!d) return;
    setForm(f => ({ ...f, name: f.name || d.name, matchValue: d.deviceName }));
  }

  function handleSave() {
    const id = form.id || toKebabId(form.name);
    onSave({ ...form, id });
  }

  function inp(key: keyof ConfiguredAudioDevice, placeholder?: string, mono?: boolean) {
    return (
      <input
        value={form[key]}
        placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{ ...fieldStyle, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)' }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        spellCheck={false}
      />
    );
  }

  return (
    <ModalShell onClose={onClose} maxWidth={460}>
      <DialogHeader title={isNew ? 'ADD SOUND DEVICE' : 'EDIT SOUND DEVICE'} onClose={onClose} />

      {liveDevices.length > 0 && (
        <Box>
          <FormLabel hint="Selects and fills the fields below">POPULATE FROM CURRENT DEVICES</FormLabel>
          <select
            defaultValue=""
            onChange={e => pickLiveDevice(e.target.value)}
            style={{ ...fieldStyle, fontFamily: 'var(--font-body)' }}
          >
            <option value="">— Select a device —</option>
            {liveDevices.map(d => (
              <option key={d.id} value={d.id}>{d.name}{d.deviceName !== d.name ? ` (${d.deviceName})` : ''}</option>
            ))}
          </select>
        </Box>
      )}

      <Box>
        <FormLabel>DISPLAY NAME</FormLabel>
        {inp('name', 'Denon AVR')}
      </Box>

      <Box>
        <FormLabel hint="Matched against device name/ID at runtime">MATCH VALUE</FormLabel>
        {inp('matchValue', 'DENON-AVR', true)}
      </Box>

      <DialogButtons onCancel={onClose} onConfirm={handleSave} confirmDisabled={!valid} />
    </ModalShell>
  );
}

export function SoundDevicesSection({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const [devices, setDevices] = useState<ConfiguredAudioDevice[]>(config.configuredAudioDevices);
  const [dialog, setDialog] = useState<{ index: number | null; device: ConfiguredAudioDevice } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(next: ConfiguredAudioDevice[]) {
    setSaving(true);
    try { await onSave({ ...config, configuredAudioDevices: next }); }
    finally { setSaving(false); }
  }

  function handleSave(device: ConfiguredAudioDevice) {
    const next = dialog!.index === null
      ? [...devices, device]
      : devices.map((d, i) => i === dialog!.index ? device : d);
    setDevices(next);
    setDialog(null);
    save(next);
  }

  function handleDelete(i: number) {
    const next = devices.filter((_, idx) => idx !== i);
    setDevices(next);
    save(next);
  }

  return (
    <>
      {dialog && <DeviceDialog device={dialog.device} onSave={handleSave} onClose={() => setDialog(null)} />}
      <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>SOUND DEVICES</Box>
            <Box sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)', mt: 0.25 }}>Named audio devices referenced by mode profiles</Box>
          </Box>
          {saving && <CircularProgress size={16} sx={{ color: 'var(--accent)' }} />}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {devices.map((d, i) => (
            <Box key={d.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1.5, py: 1.25, borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent)', minWidth: 100, flexShrink: 0 }}>{d.id}</Box>
              <Box sx={{ fontSize: '0.82rem', color: 'var(--text-primary)', minWidth: 100, flexShrink: 0 }}>{d.name}</Box>
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.matchValue}</Box>
              <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
                <EditOutlinedIcon onClick={() => setDialog({ index: i, device: { ...d } })} sx={{ fontSize: 16, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--accent)' } }} />
                <DeleteOutlineIcon onClick={() => handleDelete(i)} sx={{ fontSize: 16, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--error)' } }} />
              </Box>
            </Box>
          ))}
        </Box>

        <Box onClick={() => setDialog({ index: null, device: emptyDevice() })} sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1, borderRadius: 8, border: '1px dashed var(--border)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.05em', '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' }, transition: 'all 0.15s' }}>
          <AddIcon sx={{ fontSize: 16 }} /> ADD DEVICE
        </Box>
      </Box>
    </>
  );
}
