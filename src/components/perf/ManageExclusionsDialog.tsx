'use client';

import { useState } from 'react';
import { Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { ModalShell } from '@/components/ui/ModalShell';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { fieldStyle } from '@/components/ui/fieldStyle';

// Manages AppConfig.processExclusions — regex source strings (case-
// insensitive) the FPS auto-detect heuristic and the process picker's
// greyed-out/bottom-sorted ranking never track. Each entry is free-text: a
// quick-exclude from the picker adds an escaped (exact) exe-name match;
// entries can be hand-edited here into broader patterns (e.g. "^ubisoft"
// to exclude every Ubisoft launcher process).
export function ManageExclusionsDialog({ exclusions, onSave, onClose }: {
  exclusions: string[];
  onSave: (next: string[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState(exclusions);
  const [newPattern, setNewPattern] = useState('');

  const commit = (next: string[]) => { setList(next); onSave(next); };
  const remove = (pattern: string) => commit(list.filter(p => p !== pattern));
  const add = () => {
    const trimmed = newPattern.trim();
    if (!trimmed || list.includes(trimmed)) return;
    commit([...list, trimmed]);
    setNewPattern('');
  };

  return (
    <ModalShell onClose={onClose} maxWidth={420}>
      <DialogHeader title="MANAGE EXCLUSIONS" onClose={onClose} />
      <Box sx={{ fontSize: '0.74rem', color: 'var(--text-dim)', mt: -1 }}>
        Processes matching any pattern below are never auto-tracked as "the game" — regex, case-insensitive, matched against the exe name.
      </Box>
      {list.length === 0 ? (
        <Box sx={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', py: 2 }}>No exclusions</Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
          {list.map(pattern => (
            <Box
              key={pattern}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                px: 1.2, py: 0.7, borderRadius: '8px', border: '1px solid var(--border)',
              }}
            >
              <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pattern}
              </Box>
              <Box
                onClick={() => remove(pattern)}
                title={`Remove ${pattern}`}
                sx={{ display: 'flex', p: 0.6, borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0, '&:hover': { color: 'var(--error)', backgroundColor: 'var(--error-dim)' } }}
              >
                <CloseIcon sx={{ fontSize: 15 }} />
              </Box>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 0.75, borderTop: list.length > 0 ? '1px solid var(--border)' : 'none', pt: list.length > 0 ? 2 : 0 }}>
        <input
          value={newPattern}
          onChange={e => setNewPattern(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="e.g. ^ubisoft or steamwebhelper\.exe"
          style={{ ...fieldStyle, fontFamily: 'var(--font-mono)' }}
        />
        <Box
          onClick={add}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.4, px: 1.5, borderRadius: '8px',
            border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.74rem', flexShrink: 0,
            '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
          }}
        >
          <AddIcon sx={{ fontSize: 15 }} /> ADD
        </Box>
      </Box>
    </ModalShell>
  );
}
