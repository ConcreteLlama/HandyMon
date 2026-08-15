'use client';

import { Box } from '@mui/material';
import { GRANT_GROUPS, ALL_GRANTS, READ_GRANTS, ACTION_GRANTS, type Grant } from '@/types/grants';
import { fieldStyle } from '@/components/ui/fieldStyle';
import { FormLabel } from '@/components/ui/FormLabel';

interface Props {
  name?: string;
  onNameChange?: (name: string) => void; // omit both to hide the name field
  grants: Set<Grant>;
  onGrantsChange: (grants: Set<Grant>) => void;
}

function setAll(current: Set<Grant>, ids: readonly Grant[], on: boolean): Set<Grant> {
  const next = new Set(current);
  ids.forEach(id => on ? next.add(id) : next.delete(id));
  return next;
}

function Pill({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.5, py: 0.5, borderRadius: 6, cursor: 'pointer',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        backgroundColor: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
        '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
      }}
    >
      {label}
    </Box>
  );
}

export function PermissionsEditor({ name, onNameChange, grants, onGrantsChange }: Props) {
  const allOn    = ALL_GRANTS.every(g => grants.has(g));
  const readOn   = READ_GRANTS.every(g => grants.has(g));
  const actionOn = ACTION_GRANTS.every(g => grants.has(g));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {onNameChange && (
        <Box>
          <FormLabel>NAME</FormLabel>
          <input
            value={name ?? ''}
            onChange={e => onNameChange(e.target.value)}
            placeholder="e.g. Kid's Phone (optional)"
            style={fieldStyle}
            spellCheck={false}
          />
        </Box>
      )}

      <Box>
        <FormLabel hint="Presets are just a shortcut — you can still fine-tune below.">PRESETS</FormLabel>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <Pill label="FULL ACCESS" active={allOn} onClick={() => onGrantsChange(new Set(ALL_GRANTS))} />
          <Pill label="VIEW ONLY" active={readOn && !actionOn} onClick={() => onGrantsChange(new Set(READ_GRANTS))} />
        </Box>
      </Box>

      <Box>
        <FormLabel>BULK SELECT</FormLabel>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Pill label={allOn ? 'DESELECT ALL' : 'SELECT ALL'} onClick={() => onGrantsChange(setAll(grants, ALL_GRANTS, !allOn))} />
          <Pill label={readOn ? 'DESELECT READ' : 'ALL READ'} onClick={() => onGrantsChange(setAll(grants, READ_GRANTS, !readOn))} />
          <Pill label={actionOn ? 'DESELECT WRITE' : 'ALL WRITE'} onClick={() => onGrantsChange(setAll(grants, ACTION_GRANTS, !actionOn))} />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {GRANT_GROUPS.map(group => {
          const groupIds = group.grants.map(g => g.id);
          const groupAllOn = groupIds.every(id => grants.has(id));
          return (
            <Box key={group.id} sx={{ border: '1px solid var(--border)', borderRadius: '8px', p: 1.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                  {group.label.toUpperCase()}
                </Box>
                <Box
                  onClick={() => onGrantsChange(setAll(grants, groupIds, !groupAllOn))}
                  sx={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--accent)', cursor: 'pointer' }}
                >
                  {groupAllOn ? 'CLEAR' : 'ALL'}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {group.grants.map(g => (
                  <Box
                    key={g.id}
                    component="label"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}
                  >
                    <input
                      type="checkbox"
                      checked={grants.has(g.id)}
                      onChange={e => {
                        const next = new Set(grants);
                        if (e.target.checked) next.add(g.id); else next.delete(g.id);
                        onGrantsChange(next);
                      }}
                    />
                    {g.label}
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
