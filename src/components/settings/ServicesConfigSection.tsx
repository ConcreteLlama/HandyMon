'use client';

import { useState } from 'react';
import {
  Box, Button, Select, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, CircularProgress,
  Autocomplete, TextField,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import { AppConfig } from '@/types/app-config';
import type { ServiceConfig } from '@/types/app-config';
import { useIsLocalhost } from '@/hooks/useIsLocalhost';
import { apiFetch } from '@/utils/api-client';
import { fieldStyle } from '@/components/ui/fieldStyle';
import { FormLabel } from '@/components/ui/FormLabel';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { helpProps } from '@/components/help/HelpModeContext';

interface DiscoveredService { name: string; displayName: string; status: string; }
type RunningFilter = 'all' | 'running' | 'stopped';

function toId(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `svc-${Date.now()}`;
}

export function ServicesConfigSection({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const isLocalhost = useIsLocalhost();
  const services = config.services ?? [];

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceConfig | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredService[] | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [runningFilter, setRunningFilter] = useState<RunningFilter>('all');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ label: '', serviceName: '', type: 'service' as 'service' | 'task', allowControl: false });

  async function loadDiscovered(type: 'service' | 'task') {
    setDiscovering(true);
    setDiscovered(null);
    try {
      const d = await apiFetch<{ services?: DiscoveredService[] }>(`/api/services/discover?type=${type}`);
      setDiscovered(d.services ?? []);
    } finally {
      setDiscovering(false);
    }
  }

  function handleTypeChange(type: 'service' | 'task') {
    setForm(f => ({ ...f, type }));
    loadDiscovered(type);
  }

  function openAdd() {
    setForm({ label: '', serviceName: '', type: 'service', allowControl: false });
    setEditing(null);
    setRunningFilter('all');
    setAddOpen(true);
    loadDiscovered('service');
  }

  function openEdit(svc: ServiceConfig) {
    setForm({ label: svc.label, serviceName: svc.serviceName, type: svc.type, allowControl: svc.allowControl });
    setEditing(svc);
    setRunningFilter('all');
    setAddOpen(true);
    loadDiscovered(svc.type);
  }

  async function saveList(next: ServiceConfig[]) {
    setSaving(true);
    try { await onSave({ ...config, services: next }); }
    finally { setSaving(false); }
  }

  async function handleSave() {
    if (!form.label.trim() || !form.serviceName.trim()) return;
    const entry: ServiceConfig = {
      id: editing?.id ?? toId(form.label),
      label: form.label.trim(),
      serviceName: form.serviceName.trim(),
      type: form.type,
      allowControl: form.allowControl,
    };
    const next = editing
      ? services.map(s => s.id === editing.id ? entry : s)
      : [...services, entry];
    await saveList(next);
    setAddOpen(false);
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await saveList(services.filter(s => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  return (
    <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isLocalhost ? 2 : 1 }}>
        <Box>
          <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
            SERVICES
          </Box>
          <Box sx={{ fontSize: '0.72rem', color: 'var(--text-secondary)', mt: 0.25 }}>
            Windows services/tasks monitorable (and optionally controllable) from paired devices
          </Box>
        </Box>
        {isLocalhost && (
          <Box
            onClick={openAdd}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.6, px: 2, py: 1, borderRadius: '8px',
              border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.05em',
              flexShrink: 0, transition: 'all 0.15s ease',
              '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-dim)' },
            }}
          >
            <AddIcon sx={{ fontSize: 15 }} /> ADD
          </Box>
        )}
      </Box>

      {!isLocalhost && (
        <Box sx={{ mb: 2, px: 1.5, py: 1, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', fontSize: '0.75rem', color: 'var(--warning)', lineHeight: 1.5 }}>
          Read-only from remote devices — connect from the host PC to add or change services.
        </Box>
      )}

      {services.length === 0 ? (
        <Box sx={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', py: 1 }}>No services configured</Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {services.map(svc => (
            <Box key={svc.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.75, px: 2, py: 1.25, borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid transparent', '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)' } }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '6px', backgroundColor: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SettingsSuggestIcon sx={{ fontSize: 15, color: 'var(--accent)' }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.label}</Box>
                <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', mt: 0.15, fontFamily: 'var(--font-mono)' }}>
                  {svc.serviceName} · {svc.allowControl ? 'monitor + control' : 'monitor only'}
                </Box>
              </Box>
              {isLocalhost && (
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  <IconButton size="small" onClick={() => openEdit(svc)} sx={{ color: 'var(--text-dim)', '&:hover': { color: 'var(--accent)', backgroundColor: 'var(--accent-dim)' } }}>
                    <EditIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => setDeleteTarget(svc)} sx={{ color: 'var(--text-dim)', '&:hover': { color: 'var(--error)', backgroundColor: 'var(--error-dim)' } }}>
                    <DeleteIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? `Edit ${editing.label}` : 'Add Service'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box>
              <FormLabel>DISPLAY NAME</FormLabel>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Apollo" style={fieldStyle} spellCheck={false} />
            </Box>

            <Box>
              <FormLabel>TYPE</FormLabel>
              <Select value={form.type} onChange={e => handleTypeChange(e.target.value as 'service' | 'task')} fullWidth sx={{ backgroundColor: 'var(--bg-elevated)' }}>
                <MenuItem value="service">Windows Service (net start/stop)</MenuItem>
                <MenuItem value="task">Scheduled Task (schtasks)</MenuItem>
              </Select>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <FormLabel hint="Running status is read directly from the OS — Service Control Manager or Task Scheduler">
                  {form.type === 'service' ? 'WINDOWS SERVICE' : 'SCHEDULED TASK'}
                </FormLabel>
                <Box sx={{ display: 'flex', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '7px', p: 0.25 }}>
                  {(['all', 'running', 'stopped'] as RunningFilter[]).map(f => (
                    <Box key={f} onClick={() => setRunningFilter(f)} sx={{
                      px: 1, py: 0.3, borderRadius: '5px', cursor: 'pointer',
                      fontFamily: 'var(--font-display)', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.04em',
                      color: runningFilter === f ? 'var(--accent)' : 'var(--text-dim)',
                      backgroundColor: runningFilter === f ? 'rgba(59,130,246,0.1)' : 'transparent',
                    }}>
                      {f.toUpperCase()}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Autocomplete
                freeSolo
                loading={discovering}
                options={(discovered ?? []).filter(d => runningFilter === 'all' ? true : runningFilter === 'running' ? d.status === 'Running' : d.status !== 'Running')}
                getOptionLabel={opt => typeof opt === 'string' ? opt : opt.name}
                inputValue={form.serviceName}
                onInputChange={(_, value) => setForm(f => ({ ...f, serviceName: value }))}
                onChange={(_, value) => {
                  if (value && typeof value !== 'string') {
                    setForm(f => ({ ...f, serviceName: value.name, label: f.label || value.displayName }));
                  }
                }}
                renderOption={(props, opt) => (
                  <Box component="li" {...props} key={opt.name} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
                    <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.displayName}{opt.displayName !== opt.name ? ` (${opt.name})` : ''}
                    </Box>
                    <Box sx={{ color: opt.status === 'Running' ? 'var(--success)' : 'var(--text-dim)', fontSize: '0.75em', flexShrink: 0 }}>{opt.status}</Box>
                  </Box>
                )}
                renderInput={params => (
                  <TextField
                    {...params}
                    placeholder={form.type === 'service' ? 'Search installed services…' : 'Search scheduled tasks…'}
                    spellCheck={false}
                    sx={{ backgroundColor: 'var(--bg-elevated)' }}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {discovering ? <CircularProgress size={14} sx={{ color: 'var(--accent)' }} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Box>

            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              {...helpProps('Allow Start/Stop', "This is the first gate, not the only one — a device still needs its own services:control grant to actually start/stop this service even when Allow Start/Stop is on here. Off overrides that grant entirely and makes the service monitor-only for everyone.")}
            >
              <Box>
                <FormLabel>ALLOW START/STOP</FormLabel>
                <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Off = monitor-only, regardless of a device's permission grants</Box>
              </Box>
              <ToggleSwitch checked={form.allowControl} onChange={() => setForm(f => ({ ...f, allowControl: !f.allowControl }))} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} sx={{ color: 'var(--text-secondary)' }}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.label.trim() || !form.serviceName.trim()}
            sx={{ color: 'var(--accent)' }}
          >
            {saving ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : (editing ? 'Update' : 'Add')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Box sx={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Remove <Box component="span" sx={{ color: 'var(--text-primary)' }}>{deleteTarget?.label}</Box>?
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: 'var(--text-secondary)' }}>Cancel</Button>
          <Button onClick={handleDelete} sx={{ color: 'var(--error)' }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
