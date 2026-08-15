'use client';

import { createPortal } from 'react-dom';
import { Box } from '@mui/material';
import type { ReactNode } from 'react';

type ModalShellProps = {
  onClose: () => void;
  maxWidth?: number;
  zIndex?: number;
  disableBackdropClose?: boolean;
  children: ReactNode;
};

// The portal + overlay + centered panel chrome shared by every modal in the
// app — pair with DialogHeader/DialogButtons for the header/footer.
//
// zIndex 1350 (default): MUI's own Dialog/Modal sits at 1300 (Snackbar at
// 1400). A few sections (ProcessLassoSection, ServicesConfigSection) still
// use raw MUI Dialog, not yet migrated to ModalShell — opening a ModalShell
// dialog from inside one of those rendered it behind the MUI Dialog's
// backdrop. 1350 clears MUI Dialog while staying below Snackbar, so a toast
// triggered from within one of our own dialogs still shows on top of it.
// Callers can override (e.g. FirstRunPairDialog uses a higher value to sit
// above OnboardingOverlay's anchored tip popovers, which sit at 2500).
//
// disableBackdropClose: for a dialog the user didn't ask to open (e.g.
// FirstRunPairDialog, which appears unprompted on first run), a stray click
// anywhere on the page — landing on the full-viewport backdrop — silently
// dismisses it with no visible feedback that anything happened. Confirmed
// live 2026-08-14: the dialog vanished with no dismissal action the user
// remembered taking. Every other ModalShell use is a dialog the user
// deliberately opened, where backdrop-click-to-close is expected and fine —
// this only opts specific callers out.
export function ModalShell({ onClose, maxWidth = 420, zIndex = 1350, disableBackdropClose = false, children }: ModalShellProps) {
  return createPortal(
    <Box
      sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}
      onClick={disableBackdropClose ? undefined : onClose}
    >
      <Box
        sx={{ width: '100%', maxWidth, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </Box>
    </Box>,
    document.body
  );
}
