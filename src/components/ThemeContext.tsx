'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { createAppTheme } from '@/app/theme';
import { DEFAULT_THEME_ID, type ThemeColors, type ThemePreset } from '@/types/theme';
import {
  loadActiveThemeId, saveActiveThemeId,
  getAllThemes, resolveTheme, applyThemeVars,
} from '@/utils/theme-storage';
import { toKebabId } from '@/utils/id';
import { useAppConfig, useUpdateAppConfig } from '@/hooks/config/useAppConfig';

type ThemeContextValue = {
  themeId: string;
  setThemeId: (id: string) => void;
  activeTheme: ThemePreset;
  allThemes: ThemePreset[];
  customThemes: ThemePreset[];
  saveCustomTheme: (name: string, colors: ThemeColors, editId?: string) => void;
  deleteCustomTheme: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within AppThemeProvider');
  return ctx;
}

// Initial render matches what the anti-FOUC inline script + server both
// assume (the built-in default) — the real stored choice is picked up in an
// effect right after mount, which is a normal re-render, not a hydration
// mismatch (server and first client render agree; only the *effect* differs).
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME_ID);
  // Custom theme *definitions* are shared config (every paired device sees
  // the same list) — only the *selected* theme id stays device-local, above.
  const { data: config } = useAppConfig();
  const updateConfig = useUpdateAppConfig();
  const customThemes = useMemo<ThemePreset[]>(() => config?.customThemes ?? [], [config]);

  useEffect(() => {
    setThemeIdState(loadActiveThemeId());
  }, []);

  const allThemes = useMemo(() => getAllThemes(customThemes), [customThemes]);
  const activeTheme = useMemo(() => resolveTheme(themeId, customThemes), [themeId, customThemes]);
  const muiTheme = useMemo(() => createAppTheme(activeTheme.colors), [activeTheme]);

  useEffect(() => {
    applyThemeVars(activeTheme.colors);
  }, [activeTheme]);

  const setThemeId = (id: string) => {
    setThemeIdState(id);
    saveActiveThemeId(id);
  };

  const saveCustomTheme = (name: string, colors: ThemeColors, editId?: string) => {
    if (!config) return;
    const preset: ThemePreset = { id: editId ?? `custom-${toKebabId(name)}-${Date.now().toString(36)}`, name, colors };
    const next = editId
      ? customThemes.map(t => t.id === editId ? preset : t)
      : [...customThemes, preset];
    updateConfig.mutate({ ...config, customThemes: next });
    setThemeId(preset.id);
  };

  const deleteCustomTheme = (id: string) => {
    if (!config) return;
    const next = customThemes.filter(t => t.id !== id);
    updateConfig.mutate({ ...config, customThemes: next });
    if (themeId === id) setThemeId(DEFAULT_THEME_ID);
  };

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, activeTheme, allThemes, customThemes, saveCustomTheme, deleteCustomTheme }}>
      <MuiThemeProvider theme={muiTheme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
