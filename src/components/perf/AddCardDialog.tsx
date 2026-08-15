'use client';

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Switch } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { IconButton } from '@mui/material';
import { usePerfPin } from './PerfPinContext';
import { CARD_GROUPS } from './cards/registry';

const rowSx = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  py: 0.75, borderBottom: '1px solid var(--border)',
  '&:last-child': { borderBottom: 'none' },
};

const groupHeaderSx = {
  fontFamily: 'var(--font-display)', fontSize: '0.55rem', fontWeight: 700,
  letterSpacing: '0.12em', color: 'var(--text-dim)',
  pt: 2, pb: 0.5,
  '&:first-of-type': { pt: 0 },
};

export function AddCardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isPinned, toggle } = usePerfPin();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { backgroundColor: 'var(--bg-raised)', backgroundImage: 'none', border: '1px solid var(--border)', borderRadius: '12px' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-primary)' }}>
        ADD CARDS
        <IconButton size="small" onClick={onClose} sx={{ color: 'var(--text-dim)' }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2, pt: 0, pb: 1 }}>
        {CARD_GROUPS.map(group => (
          <Box key={group.label}>
            <Box sx={groupHeaderSx}>{group.label}</Box>
            {group.cards.map(card => (
              <Box key={card.id} sx={rowSx}>
                <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: isPinned(card.id) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {card.label}
                </Box>
                <Switch
                  checked={isPinned(card.id)}
                  onChange={() => toggle(card.id)}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--accent)' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'var(--accent)', opacity: 0.5 },
                  }}
                />
              </Box>
            ))}
          </Box>
        ))}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} fullWidth variant="outlined" sx={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', borderColor: 'var(--border)', color: 'var(--text-secondary)', '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' } }}>
          DONE
        </Button>
      </DialogActions>
    </Dialog>
  );
}
