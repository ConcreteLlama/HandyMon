import { ReactNode } from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export function DialogHeader({ title, onClose, sx, startAdornment, endAdornment }: { title: string; onClose: () => void; sx?: SxProps<Theme>; startAdornment?: ReactNode; endAdornment?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        {startAdornment}
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
          {title}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
        {endAdornment}
        <CloseIcon onClick={onClose} sx={{ fontSize: 18, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--text-primary)' } }} />
      </Box>
    </Box>
  );
}
