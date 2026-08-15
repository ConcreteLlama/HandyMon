'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface HelpModeCtx {
  active: boolean;
  toggle: () => void;
  deactivate: () => void;
}

const HelpModeContext = createContext<HelpModeCtx>({
  active: false,
  toggle: () => {},
  deactivate: () => {},
});

export const useHelpMode = () => useContext(HelpModeContext);

export function HelpModeProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const toggle = useCallback(() => setActive(a => !a), []);
  const deactivate = useCallback(() => setActive(false), []);

  return (
    <HelpModeContext.Provider value={{ active, toggle, deactivate }}>
      {children}
    </HelpModeContext.Provider>
  );
}

// Any component wanting to be help-mode-tappable spreads this onto a Box
// (or any element) — HelpOverlay's click interceptor walks up the DOM via
// closest('[data-help-title]'), so this works on plain host elements with
// zero extra wrapper divs (which would otherwise risk breaking flex/grid
// layouts the target is already part of).
export function helpProps(title: string, body: string) {
  return { 'data-help-title': title, 'data-help-body': body } as const;
}
