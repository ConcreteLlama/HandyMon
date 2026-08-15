import { Box } from '@mui/material';

export function DialogButtons({
  onCancel,
  onConfirm,
  cancelLabel = 'CANCEL',
  confirmLabel = 'SAVE',
  confirmDisabled = false,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
      <Box
        onClick={onCancel}
        sx={{ px: 2, py: 0.75, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.05em', '&:hover': { backgroundColor: 'var(--border)' } }}
      >
        {cancelLabel}
      </Box>
      <Box
        onClick={!confirmDisabled ? onConfirm : undefined}
        sx={{ px: 2, py: 0.75, borderRadius: 7, backgroundColor: !confirmDisabled ? 'var(--accent)' : 'rgba(59,130,246,0.25)', color: !confirmDisabled ? 'white' : 'rgba(255,255,255,0.3)', cursor: !confirmDisabled ? 'pointer' : 'default', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.05em' }}
      >
        {confirmLabel}
      </Box>
    </Box>
  );
}
