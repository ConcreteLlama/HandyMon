'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Popover, Tooltip } from '@mui/material';
import { HexColorPicker } from 'react-colorful';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { useAppTheme } from '../ThemeContext';
import { PREDEFINED_THEMES } from '@/types/theme';
import type { ThemeColors, ThemePreset } from '@/types/theme';
import { applyThemeVars } from '@/utils/theme-storage';
import { fieldStyle } from '../ui/fieldStyle';
import { FormLabel } from '../ui/FormLabel';
import { DeleteConfirmDialog } from '../ui/DeleteConfirmDialog';
import { useGrants } from '@/hooks/auth/useGrants';

const PREDEFINED_IDS = new Set(PREDEFINED_THEMES.map(t => t.id));

function ThemeSwatch({ theme, active, onClick, onEdit, onDelete }: {
  theme: ThemePreset; active: boolean; onClick: () => void;
  onEdit?: () => void; onDelete?: () => void;
}) {
  const c = theme.colors;
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer',
        border: `1.5px solid ${active ? c.accent : 'var(--border)'}`,
        backgroundColor: c.bgBase, transition: 'border-color 0.15s ease',
        '&:hover': { borderColor: c.accent },
      }}
    >
      <Box sx={{ display: 'flex', height: 36 }}>
        <Box sx={{ flex: 1, backgroundColor: c.bgRaised }} />
        <Box sx={{ flex: 1, backgroundColor: c.bgElevated }} />
        <Box sx={{ flex: 1, backgroundColor: c.accent }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.2, py: 0.8 }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em', color: c.textPrimary }}>
          {theme.name}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {active && <CheckIcon sx={{ fontSize: 14, color: c.accent }} />}
          {onEdit && (
            <Box onClick={e => { e.stopPropagation(); onEdit(); }} sx={{ display: 'flex', color: c.textSecondary, '&:hover': { color: c.accent } }}>
              <EditIcon sx={{ fontSize: 13 }} />
            </Box>
          )}
          {onDelete && (
            <Box onClick={e => { e.stopPropagation(); onDelete(); }} sx={{ display: 'flex', color: c.textSecondary, '&:hover': { color: 'var(--error)' } }}>
              <CloseIcon sx={{ fontSize: 13 }} />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function CreateThemeCard({ active, onClick, lockedReason }: { active: boolean; onClick: () => void; lockedReason?: string }) {
  const locked = !!lockedReason;
  const card = (
    <Box
      onClick={locked ? undefined : onClick}
      sx={{
        borderRadius: '10px', overflow: 'hidden', cursor: locked ? 'default' : 'pointer',
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        backgroundColor: active ? 'var(--accent-dim)' : 'transparent',
        opacity: locked ? 0.5 : 1,
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        '&:hover': locked ? undefined : { borderColor: 'var(--accent)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 36 }}>
        <AddIcon sx={{ fontSize: 18, color: active ? 'var(--accent)' : 'var(--text-dim)' }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: 1.2, py: 0.8 }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em', color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>
          NEW THEME
        </Box>
      </Box>
    </Box>
  );
  return locked ? <Tooltip title={lockedReason} arrow>{card}</Tooltip> : card;
}

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'bgBase', label: 'Background' },
  { key: 'bgRaised', label: 'Panels' },
  { key: 'bgElevated', label: 'Elevated' },
  { key: 'border', label: 'Border' },
  { key: 'borderHover', label: 'Border (hover)' },
  { key: 'accent', label: 'Accent' },
  { key: 'success', label: 'Success' },
  { key: 'error', label: 'Error' },
  { key: 'warning', label: 'Warning' },
  { key: 'textPrimary', label: 'Text' },
  { key: 'textSecondary', label: 'Text (secondary)' },
  { key: 'textDim', label: 'Text (dim)' },
];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        onClick={e => setAnchor(e.currentTarget)}
        title={label}
        sx={{
          width: 32, height: 32, flexShrink: 0, borderRadius: '6px', cursor: 'pointer',
          border: '1px solid var(--border)', backgroundColor: value,
          '&:hover': { borderColor: 'var(--border-hover)' },
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', mb: 0.2 }}>{label}</Box>
        <input value={value} onChange={e => onChange(e.target.value)} style={{ ...fieldStyle, padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }} />
      </Box>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', p: 1.5, mt: 0.5 } } }}
      >
        <Box sx={{ '& .react-colorful': { width: 180, height: 140 } }}>
          <HexColorPicker color={value} onChange={onChange} />
        </Box>
      </Popover>
    </Box>
  );
}

function ThemeEditor({ initial, onSave, onCancel }: {
  initial?: ThemePreset;
  onSave: (name: string, colors: ThemeColors) => void;
  onCancel: () => void;
}) {
  const { activeTheme } = useAppTheme();
  // Editing an existing theme starts from its own colors; creating a new one
  // starts from whatever's currently active, not a fixed default — so
  // "create custom theme" reads as "start from what I'm looking at now."
  const base: ThemeColors = initial?.colors ?? activeTheme.colors;
  const [name, setName] = useState(initial?.name ?? '');
  const [colors, setColors] = useState<ThemeColors>(base);
  // Set right before a successful SAVE so the unmount-cleanup below skips its
  // revert — by the time this component unmounts after a save, the theme
  // context has already applied the new (saved) colors, and reverting to the
  // pre-edit theme on top of that would flicker back before settling again.
  const savedRef = useRef(false);

  // Live preview — the rest of the app reflects edits as they're made, not
  // just after SAVE. Revert to whatever's actually active on cancel/unmount
  // (e.g. navigating away mid-edit) so a discarded edit never lingers.
  useEffect(() => {
    applyThemeVars(colors);
    return () => {
      if (!savedRef.current) applyThemeVars(activeTheme.colors);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors]);

  const set = (key: keyof ThemeColors) => (v: string) => setColors(c => ({ ...c, [key]: v }));
  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    savedRef.current = true;
    onSave(name.trim(), colors);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2, pt: 2, borderTop: '1px solid var(--border)' }}>
      <Box>
        <FormLabel>NAME</FormLabel>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="My theme…" style={fieldStyle} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
        {COLOR_FIELDS.map(f => (
          <ColorField key={f.key} label={f.label} value={colors[f.key]} onChange={set(f.key)} />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 0.5 }}>
        <Box onClick={onCancel} sx={{ px: 1.5, py: 0.6, borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', '&:hover': { backgroundColor: 'var(--border)' } }}>
          CANCEL
        </Box>
        <Box
          onClick={handleSave}
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

export function AppearanceSection() {
  const { themeId, setThemeId, allThemes, saveCustomTheme, deleteCustomTheme } = useAppTheme();
  const { has, loaded } = useGrants();
  // Selecting any theme is always unrestricted — this only gates creating,
  // editing, or deleting custom themes, which are shared config visible to
  // every paired device. Default to allowed until grants load, matching the
  // rest of the app's client-side-gating pattern (server-side check is the
  // real boundary regardless).
  const canEditThemes = !loaded || has('appearance:write');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ThemePreset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ThemePreset | null>(null);

  return (
    <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3 }}>
      <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
        APPEARANCE
      </Box>
      <Box sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)', mt: 0.25, mb: 2 }}>
        Theme choice is saved on this device only — other paired devices keep their own. Custom themes are shared with every paired device.
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 1 }}>
        {allThemes.map(theme => (
          <ThemeSwatch
            key={theme.id}
            theme={theme}
            active={theme.id === themeId}
            onClick={() => setThemeId(theme.id)}
            onEdit={canEditThemes && !PREDEFINED_IDS.has(theme.id) ? () => setEditing(theme) : undefined}
            onDelete={canEditThemes && !PREDEFINED_IDS.has(theme.id) ? () => setDeleteTarget(theme) : undefined}
          />
        ))}
        <CreateThemeCard
          active={adding}
          onClick={() => setAdding(true)}
          lockedReason={canEditThemes ? undefined : "You don't have permission to create themes"}
        />
      </Box>

      {adding && (
        <ThemeEditor
          onSave={(name, colors) => { saveCustomTheme(name, colors); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      )}

      {editing && (
        <ThemeEditor
          initial={editing}
          onSave={(name, colors) => { saveCustomTheme(name, colors, editing.id); setEditing(null); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          title="Delete Theme"
          message={<>Remove <Box component="span" sx={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</Box>? This can't be undone.</>}
          onConfirm={() => { deleteCustomTheme(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Box>
  );
}
