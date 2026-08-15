'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';

import { NAV_ITEMS, orderNavItems, type SectionId } from './nav-items';
import { useAppConfig } from '@/hooks/config/useAppConfig';
import { AudioDeviceSelector } from './AudioDeviceSelector';
import { DisplayControl } from './DisplayControl';
import { FanControlSelector } from './FanControlSelector';
import { RTSSSection } from './rtss/RTSSSection';
import { ProcessLassoSection } from './process-lasso/ProcessLassoSection';
import { ServicesSection } from './ServicesSection';
import { SettingsPage } from './settings/SettingsPage';
import { ActionsSection } from './ActionsSection';
import { VirtualKeyboardSection } from './VirtualKeyboardSection';
import { TaskSwitcherSection } from './TaskSwitcherSection';
import { PerfSection } from './perf/PerfSection';
import { SwipeableTabs, type SwipeTab } from './ui/SwipeableTabs';
import { useGrants } from '@/hooks/auth/useGrants';
import type { Grant } from '@/types/grants';

// Any one of these grants present ⇒ the section is reachable at all. This is
// UI polish only — every route behind each section re-checks its own grant
// server-side regardless of whether the nav item is shown.
const SECTION_GRANTS: Record<SectionId, Grant[]> = {
  actions:   ['actions:read', 'actions:execute', 'actions:edit'],
  output:    ['displayoutput:read', 'displayoutput:write'],
  gaming:    ['gaming:read', 'gaming:write'],
  perf:      ['perf:read', 'perf:capture'],
  processes: ['processes:read', 'processes:kill'],
  system:    ['fans:read', 'fans:write', 'processlasso:read', 'processlasso:write', 'services:read', 'services:control'],
  keyboard:  ['keyboard:execute'],
  settings:  ['settings:read', 'settings:write'],
};

const SECTION_META: Record<SectionId, { title: string; subtitle: string }> = {
  actions:  { title: 'Actions',     subtitle: 'Launch programs, trigger hotkeys, or apply display/audio/fan presets' },
  output:   { title: 'Output',      subtitle: 'Display layouts and audio devices' },
  gaming:   { title: 'Gaming',      subtitle: 'Overlay and framerate tools' },
  perf:     { title: 'Performance', subtitle: 'Live CPU, GPU, and memory stats' },
  processes:{ title: 'Processes',   subtitle: 'Running apps with live CPU & memory usage' },
  system:   { title: 'System',      subtitle: 'Fans, Process Lasso, and streaming' },
  keyboard: { title: 'Keyboard',    subtitle: 'Type or paste text into the focused app on the host PC' },
  settings: { title: 'Settings',    subtitle: 'Tool paths, display profiles, and nav order' },
};

const SYSTEM_TAB_IDS = ['fans', 'lasso', 'services'] as const;
type SystemTabId = typeof SYSTEM_TAB_IDS[number];

const OUTPUT_TAB_IDS = ['display', 'audio'] as const;
type OutputTabId = typeof OUTPUT_TAB_IDS[number];

function setUrlParam(key: string, value: string) {
  const params = new URLSearchParams(window.location.search);
  params.set(key, value);
  window.history.replaceState(null, '', `?${params.toString()}`);
}

export const AppShell = () => {
  // Start from SSR-safe defaults, then adopt any deep-linked state after mount.
  // (Reading window.location in the initializer would mismatch the server HTML.)
  const [active, setActive]       = useState<SectionId>('actions');
  const [systemTab, setSystemTab] = useState<SystemTabId>('fans');
  const [outputTab, setOutputTab] = useState<OutputTabId>('display');
  // A custom threshold, not theme.breakpoints.down('md') (900px) — that's
  // shared by unrelated responsive rules elsewhere (padding, etc.), and
  // changing it to fix this would've shifted all of those too. 900px put a
  // tablet, even zoomed out for more working room, right in the sidebar's
  // way: its fixed ~220px width ate into a content area that wasn't actually
  // wide enough yet to spare it (reported live 2026-08-15). Bottom nav now
  // holds until content has genuinely wide-desktop room to give up.
  const isMobile = useMediaQuery('(max-width:1299.95px)');
  const meta = SECTION_META[active];

  // Bottom nav is left-aligned + horizontally scrollable by default (needed
  // when there are more items than fit on a narrow phone), but that leaves a
  // lot of dead space on the right on a wider device that's still in mobile
  // layout — e.g. a tablet zoomed out, now that the sidebar breakpoint sits
  // higher (flagged live 2026-08-15). Only center when the items genuinely
  // fit without scrolling; centering an overflowing scrollable flex row
  // would make it scroll symmetrically off both edges instead of starting
  // flush left on item one, which is worse than the dead space it'd fix.
  //
  // A callback ref, not a plain useRef — this Box only mounts once isMobile
  // flips true (it starts false, the SSR-safe default, until after
  // hydration), so a useRef + effect gated on an unrelated dependency array
  // would fire before the node exists and never re-check once it actually
  // mounts (same trap as usePerfGridMode.ts's gridContainerRef).
  const [bottomNavNode, setBottomNavNode] = useState<HTMLElement | null>(null);
  const bottomNavRef = useCallback((node: HTMLElement | null) => setBottomNavNode(node), []);
  const [bottomNavFits, setBottomNavFits] = useState(false);

  // Set once a URL deep-link or a manual nav click has decided the active
  // section — prevents the "default to first item" effect below from
  // clobbering that once config finishes loading (config load is async, so
  // it can resolve after either of those has already happened).
  const explicitSectionRef = useRef(false);

  const { data: config } = useAppConfig();
  const orderedNavItems = orderNavItems(config?.navOrder);

  // Hide nav items the current device has zero grants for at all — polish
  // only, every route behind them is already gated server-side regardless.
  const { grants: myGrants, loaded: grantsLoaded } = useGrants();
  const visibleNavItems = !grantsLoaded ? orderedNavItems : orderedNavItems.filter(n => SECTION_GRANTS[n.id].some(g => myGrants.has(g)));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('section');
    if (s && NAV_ITEMS.some(n => n.id === s)) { setActive(s as SectionId); explicitSectionRef.current = true; }
    const st = params.get('systemtab');
    if (st && (SYSTEM_TAB_IDS as readonly string[]).includes(st)) setSystemTab(st as SystemTabId);
    const ot = params.get('outputtab');
    if (ot && (OUTPUT_TAB_IDS as readonly string[]).includes(ot)) setOutputTab(ot as OutputTabId);
  }, []);

  // The first item in your nav order is your "homepage" — once grants and
  // any custom order have loaded, land there by default (unless a deep link
  // or manual navigation already decided otherwise).
  useEffect(() => {
    if (explicitSectionRef.current) return;
    if (!grantsLoaded || visibleNavItems.length === 0) return;
    setActive(visibleNavItems[0].id);
  }, [grantsLoaded, visibleNavItems]);

  useEffect(() => {
    if (!bottomNavNode) return;
    const check = () => setBottomNavFits(bottomNavNode.scrollWidth <= bottomNavNode.clientWidth + 1); // +1: rounding slop
    check();
    const observer = new ResizeObserver(check);
    observer.observe(bottomNavNode);
    return () => observer.disconnect();
  }, [bottomNavNode]);

  const navigate = (id: SectionId) => {
    explicitSectionRef.current = true;
    setActive(id);
    setUrlParam('section', id);
  };

  const changeSystemTab = (id: string) => {
    setSystemTab(id as SystemTabId);
    setUrlParam('systemtab', id);
  };

  const changeOutputTab = (id: string) => {
    setOutputTab(id as OutputTabId);
    setUrlParam('outputtab', id);
  };

  const systemTabs: SwipeTab[] = [
    { id: 'fans',    label: 'FANS',    content: <FanControlSelector /> },
    { id: 'lasso',   label: 'LASSO',   content: <ProcessLassoSection /> },
    { id: 'services', label: 'SERVICES', content: <ServicesSection /> },
  ];

  const outputTabs: SwipeTab[] = [
    { id: 'display', label: 'DISPLAY', content: <DisplayControl /> },
    { id: 'audio',   label: 'AUDIO',   content: <AudioDeviceSelector /> },
  ];

  const renderSection = () => {
    switch (active) {
      case 'actions':  return <ActionsSection />;
      case 'output':   return (
        <SwipeableTabs tabs={outputTabs} activeId={outputTab} onChange={changeOutputTab} />
      );
      case 'gaming':   return <RTSSSection />;
      case 'perf':     return <PerfSection />;
      case 'processes': return <TaskSwitcherSection />;
      case 'system':   return (
        <SwipeableTabs tabs={systemTabs} activeId={systemTab} onChange={changeSystemTab} />
      );
      case 'keyboard': return <VirtualKeyboardSection />;
      case 'settings': return <SettingsPage />;
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-base)',
    }}>

      {/* ── Desktop sidebar ── */}
      {!isMobile && (
        <Box
          component="nav"
          sx={{
            width: 'var(--sidebar-width)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--nav-bg)',
            borderRight: '1px solid var(--border)',
          }}
        >
          {/* Logo */}
          <Box sx={{ p: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              backgroundColor: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 12px rgba(59,130,246,0.4)',
            }}>
              <BoltIcon sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Box sx={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '0.9rem',
                letterSpacing: '0.1em',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}>
                HANDYMON
              </Box>
              <Box sx={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                color: 'var(--text-dim)',
                letterSpacing: '0.06em',
                mt: 0.3,
              }}>
                LOCAL SYSTEM
              </Box>
            </Box>
          </Box>

          <Box sx={{ mx: 2, mb: 2, height: '1px', backgroundColor: 'var(--border)' }} />

          {/* Nav items */}
          <Box sx={{ flex: 1, px: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {visibleNavItems.map(({ id, label, Icon }) => {
              const isActive = active === id;
              return (
                <Box
                  key={id}
                  onClick={() => navigate(id)}
                  // Switching sections is navigation, not an action — stays
                  // clickable in help mode (see HelpOverlay.tsx).
                  data-help-ignore
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 1.25,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    backgroundColor: isActive ? 'var(--accent-dim)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    '&:hover': {
                      backgroundColor: isActive ? 'var(--accent-dim)' : 'rgba(255,255,255,0.04)',
                      color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                    },
                    '&::before': isActive ? {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '20%',
                      bottom: '20%',
                      width: 3,
                      backgroundColor: 'var(--accent)',
                      borderRadius: '0 3px 3px 0',
                      boxShadow: '0 0 8px var(--accent-glow)',
                    } : {},
                  }}
                >
                  <Icon sx={{ fontSize: 19, flexShrink: 0 }} />
                  <Box sx={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.88rem',
                    letterSpacing: '0.06em',
                  }}>
                    {label.toUpperCase()}
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Footer */}
          <Box sx={{
            p: 2.5,
            borderTop: '1px solid var(--border)',
          }}>
            <Box sx={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.62rem',
              color: 'var(--text-dim)',
              letterSpacing: '0.04em',
              lineHeight: 1.7,
            }}>
              <Box>:44558</Box>
              <Box>v0.1.0</Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Main content ── */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: `
          radial-gradient(ellipse 70% 40% at 5% -5%, rgba(59,130,246,0.05) 0%, transparent 100%),
          var(--bg-base)
        `,
      }}>
        {/* Section header */}
        <Box sx={{
          px: { xs: 2.5, md: 4 },
          py: { xs: 1.75, md: 2.25 },
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <Box sx={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: { xs: '1.4rem', md: '1.6rem' },
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
            lineHeight: 1.1,
          }}>
            {meta.title.toUpperCase()}
          </Box>
          <Box sx={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            mt: 0.4,
            letterSpacing: '0.01em',
          }}>
            {meta.subtitle}
          </Box>
        </Box>

        {/* Scrollable content */}
        <Box sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2, md: 3 },
          pt: { xs: 2, md: 2.5 },
          pb: { xs: 'calc(var(--bottom-nav-height) + 16px)', md: 2.5 },
        }}>
          {/* 800 keeps text-heavy pages (Actions, Settings) at a readable
              line length. Perf is the exception: its grid view mode wants to
              flow into more columns on a wide screen, which a fixed cap
              would defeat by capping card width instead. */}
          <Box sx={{ maxWidth: active === 'perf' ? 'none' : 800, mx: 'auto' }}>
            {renderSection()}
          </Box>
        </Box>
      </Box>

      {/* ── Mobile bottom nav ── */}
      {isMobile && (
        <Box
          ref={bottomNavRef}
          component="nav"
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 'var(--bottom-nav-height)',
            backgroundColor: 'var(--nav-bg)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: bottomNavFits ? 'center' : 'flex-start',
            overflowX: 'auto',
            zIndex: 100,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {visibleNavItems.map(({ id, label, Icon }) => {
            const isActive = active === id;
            return (
              <Box
                key={id}
                onClick={() => navigate(id)}
                data-help-ignore
                sx={{
                  minWidth: 64,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.4,
                  cursor: 'pointer',
                  color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                  position: 'relative',
                  transition: 'color 0.15s ease',
                  '&::after': isActive ? {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '20%',
                    right: '20%',
                    height: '2px',
                    backgroundColor: 'var(--accent)',
                    borderRadius: '0 0 4px 4px',
                    boxShadow: '0 0 8px var(--accent-glow)',
                  } : {},
                }}
              >
                <Icon sx={{ fontSize: 21 }} />
                <Box sx={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: '0.58rem',
                  letterSpacing: '0.07em',
                }}>
                  {label.toUpperCase()}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
