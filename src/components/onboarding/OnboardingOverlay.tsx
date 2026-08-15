'use client';

import { useEffect, useState } from 'react';
import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ONBOARDING_TIPS, type OnboardingTip } from './tips';
import { useOnboardingDismissals } from '@/hooks/onboarding/useOnboardingDismissals';
import { useIsLocalhost } from '@/hooks/useIsLocalhost';

const POPOVER_WIDTH = 300;
const MARGIN = 12;
const Z = 2500; // below HelpOverlay's toggle (3000) so that stays reachable; above normal page content

function isEligible(tip: OnboardingTip, dismissed: Record<string, number>): boolean {
  return !(dismissed[tip.id] >= tip.version);
}

interface Shown {
  tip: OnboardingTip;
  rect: DOMRect;
}

// Proactive, unprompted "look here" popups — the opposite of HelpOverlay's
// opt-in tap-to-explore mode. At most one shows at a time: whichever comes
// first (registry order) among tips that are both (a) not yet dismissed at
// their current version for this device and (b) actually have their target
// element mounted right now. A MutationObserver re-scans on DOM changes
// (switching sections mounts/unmounts content) so the next eligible tip
// picks up automatically once the current one is dismissed or its target
// unmounts.
export function OnboardingOverlay() {
  // Host-only: config/setup happens on the host, and Actions in particular
  // are host-edited (a paired device typically only has actions:execute,
  // not actions:edit) — a paired remote device has no reason to see these.
  // The API routes enforce this server-side too (localhostOnly), this is
  // just what skips the pointless fetch/DOM-scan on a device that could
  // never see a tip target anyway.
  const isLocalhost = useIsLocalhost();
  const { dismissed, loaded, dismiss } = useOnboardingDismissals(isLocalhost);
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    // Wait for the real dismissal state, not just isLocalhost — scanning
    // before it loads would treat every tip as eligible, flashing one
    // on-screen for an already-dismissed device until the real data lands.
    if (!isLocalhost || !loaded) return;
    const scan = () => {
      for (const tip of ONBOARDING_TIPS) {
        if (!isEligible(tip, dismissed)) continue;
        const el = document.querySelector(`[data-tip-id="${tip.id}"]`);
        if (el) {
          setShown({ tip, rect: el.getBoundingClientRect() });
          return;
        }
      }
      setShown(null);
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', scan);
    window.addEventListener('scroll', scan, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scan);
      window.removeEventListener('scroll', scan, true);
    };
  }, [dismissed, isLocalhost, loaded]);

  if (!shown) return null;
  const { tip, rect } = shown;

  const left = Math.min(Math.max(rect.left, MARGIN), window.innerWidth - POPOVER_WIDTH - MARGIN);
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow > 160 ? rect.bottom + 10 : Math.max(MARGIN, rect.top - 150);

  const dismissThis = () => dismiss({ [tip.id]: tip.version });
  const dismissSection = () => dismiss(Object.fromEntries(
    ONBOARDING_TIPS.filter(t => t.section === tip.section).map(t => [t.id, t.version]),
  ));
  const dismissAll = () => dismiss(Object.fromEntries(ONBOARDING_TIPS.map(t => [t.id, t.version])));

  return (
    <Box
      data-help-ignore
      sx={{
        position: 'fixed', left, top, width: POPOVER_WIDTH, zIndex: Z,
        backgroundColor: 'var(--bg-raised)', border: '1px solid var(--accent)',
        borderRadius: '10px', boxShadow: '0 8px 28px rgba(0,0,0,0.5)', p: 1.5,
        animation: 'onboarding-pop-in 0.2s ease-out',
        '@keyframes onboarding-pop-in': {
          from: { opacity: 0, transform: 'translateY(-4px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--accent)' }}>
          {tip.title}
        </Box>
        <IconButton size="small" onClick={dismissThis} sx={{ p: 0.25, mt: -0.25, mr: -0.5, color: 'var(--text-dim)' }}>
          <CloseIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>
      <Box sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, mb: 1.25 }}>
        {tip.body}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.04em' }}>
        <Box component="button" onClick={dismissThis} sx={btnSx('var(--accent)')}>DISMISS</Box>
        <Box component="button" onClick={dismissSection} sx={btnSx('var(--text-secondary)')}>DISMISS SECTION</Box>
        <Box component="button" onClick={dismissAll} sx={btnSx('var(--text-dim)')}>DISMISS ALL</Box>
      </Box>
    </Box>
  );
}

const btnSx = (color: string) => ({
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', color,
  '&:hover': { textDecoration: 'underline' },
});
