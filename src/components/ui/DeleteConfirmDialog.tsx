'use client';

import { createPortal } from 'react-dom';
import { Box } from '@mui/material';
import type { ReactNode } from 'react';

type DeleteConfirmDialogProps = {
  title: string;
  message: ReactNode;
  // If set, the dialog shows this instead of message/confirm — e.g. "can't
  // delete, still referenced by X" — and only offers a Close action.
  blockedMessage?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteConfirmDialog({ title, message, blockedMessage, confirmLabel = 'DELETE', onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const blocked = !!blockedMessage;
  return createPortal(
    <Box sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1360, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }} onClick={onCancel}>
      <Box sx={{ width: '100%', maxWidth: 340, backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }} onClick={e => e.stopPropagation()}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>{title}</Box>
        <Box sx={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {blocked ? blockedMessage : message}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
          <Box onClick={onCancel} sx={{ px: 2, py: 0.75, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.05em', '&:hover': { backgroundColor: 'var(--border)' } }}>
            {blocked ? 'CLOSE' : 'CANCEL'}
          </Box>
          {!blocked && (
            <Box onClick={onConfirm} sx={{ px: 2, py: 0.75, borderRadius: 7, backgroundColor: 'var(--error)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.05em' }}>
              {confirmLabel}
            </Box>
          )}
        </Box>
      </Box>
    </Box>,
    document.body
  );
}
