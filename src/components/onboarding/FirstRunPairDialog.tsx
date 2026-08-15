'use client';

import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { useOnboardingDismissals } from '@/hooks/onboarding/useOnboardingDismissals';
import { useIsLocalhost } from '@/hooks/useIsLocalhost';
import { ModalShell } from '@/components/ui/ModalShell';
import { DialogHeader } from '@/components/ui/DialogHeader';

const NOTICE_ID = 'first-run-pair';
const NOTICE_VERSION = 1;

// A one-time, page-agnostic notice — unlike OnboardingOverlay's tips, which
// only appear once their target element is mounted on screen, this shows
// centered over whatever page the host device lands on first, since a new
// install has no obvious page for "you can pair other devices" to anchor to.
// Shares the same flat tipId -> acknowledged-version dismissal store as the
// tip system, just rendered through its own modal instead of an anchored
// popover.
export function FirstRunPairDialog() {
  const isLocalhost = useIsLocalhost();
  const { dismissed, loaded, dismiss, dismissAsync } = useOnboardingDismissals(isLocalhost);

  // ModalShell portals into document.body, which doesn't exist during SSR, so
  // wait for a real mounted client pass before ever deciding to show. Waiting
  // on `loaded` too (not just `dismissed` defaulting to {}) matters even more
  // here than it does for the tip system's anchored popovers: this is a
  // full-screen modal, so an already-dismissed user would otherwise see it
  // flash on screen for a moment on every load before the real dismissal
  // state came back and yanked it away again (reported live 2026-08-14).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !isLocalhost || !loaded) return null;
  if (dismissed[NOTICE_ID] >= NOTICE_VERSION) return null;

  const gotIt = () => dismiss({ [NOTICE_ID]: NOTICE_VERSION });
  // Full navigation, since this dialog is mounted at the Providers level
  // (outside AppShell's own state) — simplest reliable way to jump to
  // Settings from here. pair=1 is a one-shot trigger PairSection reads on
  // mount to auto-open the same form its own PAIR button opens. Awaits the
  // dismiss write (not the fire-and-forget `dismiss`) — navigating away
  // immediately after mutate() can cancel its in-flight request before the
  // write lands, reopening this same dialog right back up on the next page
  // (observed live 2026-08-14).
  const pairNow = async () => {
    await dismissAsync({ [NOTICE_ID]: NOTICE_VERSION });
    window.location.href = '/?section=settings&pair=1';
  };

  return (
    <ModalShell onClose={gotIt} maxWidth={380} zIndex={2600} disableBackdropClose>
      <DialogHeader
        title="PAIR A DEVICE"
        onClose={gotIt}
        startAdornment={
          <Box sx={{ width: 30, height: 30, borderRadius: '8px', backgroundColor: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <QrCode2Icon sx={{ fontSize: 16, color: 'var(--accent)' }} />
          </Box>
        }
      />
      <Box sx={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Control this PC from your phone or another device on your network by pairing it with a QR code — head to{' '}
        <strong style={{ color: 'var(--text-primary)' }}>Settings → Paired Devices</strong>, or right-click the HandyMon tray icon and choose{' '}
        <strong style={{ color: 'var(--text-primary)' }}>Pair new device</strong>.
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.25 }}>
        <Box
          component="button"
          onClick={gotIt}
          sx={{
            px: 2, py: 0.85, borderRadius: 7, border: '1px solid var(--border)', backgroundColor: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em',
            '&:hover': { backgroundColor: 'var(--border)' },
          }}
        >
          GOT IT
        </Box>
        <Box
          component="button"
          onClick={pairNow}
          sx={{
            px: 2, py: 0.85, borderRadius: 7, border: 'none',
            backgroundColor: 'var(--accent)', color: 'white', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em',
            '&:hover': { backgroundColor: 'rgba(59,130,246,0.85)' },
          }}
        >
          PAIR DEVICE NOW
        </Box>
      </Box>
    </ModalShell>
  );
}
