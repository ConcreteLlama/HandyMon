'use client';

import { useEffect, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useHelpMode } from './HelpModeContext';

interface PopoverState {
  title: string;
  body: string;
  x: number;
  y: number;
}

const POPOVER_WIDTH = 280;
const MARGIN = 12;
// Above every dialog in the app: MUI's own Dialog/Modal sits at 1300
// (Snackbar 1400), ModalShell at 1350 (see its own comment for why).
// Fixed + this high means the toggle stays reachable even with a dialog
// open, so help mode can be turned on to ask about something inside one
// instead of only ever the page behind it.
const TOGGLE_Z = 3000;

// Mounted once near the root. The toggle button always renders, regardless
// of active state, so it's reachable from anywhere including on top of an
// open dialog — everything else (banner/highlight CSS/popover/the click
// interceptor) only exists while help mode is active. While active, a
// capture-phase document click listener intercepts every click before it
// ever reaches its real target — this is what stops e.g. tapping a
// kill-process button from actually killing the process while you're just
// trying to find out what it does. If the click landed on (or inside)
// something carrying data-help-title (see helpProps in
// HelpModeContext.tsx), a popover shows its content instead; otherwise the
// click is simply swallowed. Elements marked data-help-ignore (the toggle
// button, the popover itself, main navigation) are exempt — navigation
// stays usable in help mode since switching where you are isn't itself an
// action.
export function HelpOverlay() {
  const { active, toggle, deactivate } = useHelpMode();
  const [popover, setPopover] = useState<PopoverState | null>(null);

  useEffect(() => {
    if (!active) { setPopover(null); return; }

    document.body.classList.add('help-mode-active');

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest('[data-help-ignore]')) return;

      e.preventDefault();
      e.stopPropagation();

      const helpEl = target.closest('[data-help-title]') as HTMLElement | null;
      if (!helpEl) { setPopover(null); return; }

      setPopover({
        title: helpEl.getAttribute('data-help-title') ?? '',
        body: helpEl.getAttribute('data-help-body') ?? '',
        x: e.clientX,
        y: e.clientY,
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPopover(prev => {
        if (prev) return null; // first Esc closes the popover...
        deactivate();          // ...second Esc (or none open) exits help mode
        return null;
      });
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.body.classList.remove('help-mode-active');
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [active, deactivate]);

  const left = popover ? Math.min(Math.max(popover.x, MARGIN), window.innerWidth - POPOVER_WIDTH - MARGIN) : 0;
  const top  = popover ? Math.min(popover.y + 16, window.innerHeight - 140) : 0;

  return (
    <>
      <Tooltip title={active ? 'Exit help mode' : 'Help — tap anything to see what it does'} placement="left">
        <IconButton
          data-help-ignore
          onClick={toggle}
          sx={{
            position: 'fixed', top: 8, right: 8, zIndex: TOGGLE_Z,
            color: active ? 'var(--accent)' : 'var(--text-dim)',
            backgroundColor: active ? 'var(--accent-dim)' : 'var(--bg-raised)',
            border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            '&:hover': { backgroundColor: active ? 'var(--accent-dim)' : 'rgba(255,255,255,0.06)', color: 'var(--accent)' },
          }}
        >
          <HelpOutlineIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>

      {active && (
        <>
          {/* Every tappable target gets a standing (not just hover) outline —
              on a phone there's no hover at all, so without this there'd be no
              way to see what's tappable short of poking around blindly. :active
              gives touch a tap-feedback flash the same way :hover does for a
              mouse. color-mix keeps the base outline subtle across every theme
              (light/dark/custom) without needing per-theme rgba constants. */}
          <style>{`
            body.help-mode-active [data-help-title] {
              outline: 1.5px dashed color-mix(in srgb, var(--accent) 50%, transparent);
              outline-offset: 2px;
              border-radius: 4px;
              cursor: help;
              transition: outline-color 0.15s, background-color 0.15s;
            }
            body.help-mode-active [data-help-title]:hover,
            body.help-mode-active [data-help-title]:active {
              outline: 2px solid var(--accent);
              background-color: color-mix(in srgb, var(--accent) 12%, transparent);
            }
          `}</style>

          <Box
            data-help-ignore
            sx={{
              position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
              zIndex: 2000, px: 2, py: 0.75, borderRadius: '999px',
              backgroundColor: 'var(--accent)', color: '#1a1206',
              fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.04em', boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              pointerEvents: 'none', textAlign: 'center', maxWidth: 'calc(90vw - 48px)',
            }}
          >
            {popover ? 'Tap elsewhere for more, or Esc to exit help mode' : 'Tap something to see what it does — Esc to exit'}
          </Box>

          {popover && (
            <Box
              data-help-ignore
              sx={{
                position: 'fixed', left, top, width: POPOVER_WIDTH, zIndex: 2001,
                backgroundColor: 'var(--bg-raised)', border: '1px solid var(--accent)',
                borderRadius: '10px', boxShadow: '0 8px 28px rgba(0,0,0,0.5)', p: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--accent)' }}>
                  {popover.title}
                </Box>
                <IconButton size="small" onClick={() => setPopover(null)} sx={{ p: 0.25, mt: -0.25, mr: -0.5, color: 'var(--text-dim)' }}>
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>
              <Box sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {popover.body}
              </Box>
            </Box>
          )}
        </>
      )}
    </>
  );
}
