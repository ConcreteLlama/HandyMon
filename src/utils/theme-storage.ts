import { PREDEFINED_THEMES, DEFAULT_THEME_ID, type ThemeColors, type ThemePreset } from '@/types/theme';

// Theme *selection* is intentionally client-only (localStorage), never
// synced via the server config — it's a per-device display preference, same
// category as perf-pinned-cards (see cards/registry.tsx). Custom theme
// *definitions* are the opposite: shared config (see AppConfig.customThemes,
// ThemeContext.tsx), same as processRulePresets, so every paired device sees
// the same palette list.
const ACTIVE_THEME_KEY = 'handymon-active-theme';

export function loadActiveThemeId(): string {
  try {
    return localStorage.getItem(ACTIVE_THEME_KEY) || DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function saveActiveThemeId(id: string): void {
  try { localStorage.setItem(ACTIVE_THEME_KEY, id); } catch {}
}

export function getAllThemes(customThemes: ThemePreset[]): ThemePreset[] {
  return [...PREDEFINED_THEMES, ...customThemes];
}

export function resolveTheme(id: string, customThemes: ThemePreset[]): ThemePreset {
  return getAllThemes(customThemes).find(t => t.id === id)
    ?? PREDEFINED_THEMES.find(t => t.id === DEFAULT_THEME_ID)!;
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex; // not a plain hex color (e.g. already rgba) — pass through
  const [r, g, b] = m.slice(1).map(x => parseInt(x, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Mixes a hex color toward black by `amount` (0-1) — used to derive the nav
// bar background from bgBase so it works for both dark and light themes
// (a fixed darkening step reads as "slightly recessed" either way, rather
// than a hardcoded near-black that only made sense for dark themes).
function darken(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const [r, g, b] = m.slice(1).map(x => parseInt(x, 16));
  const f = 1 - amount;
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r * f)}${toHex(g * f)}${toHex(b * f)}`;
}

// The CSS var names/values every theme resolves to, including the derived
// alpha ("dim"/"glow") variants — single source of truth shared by the
// anti-FOUC inline script (as a string template) and the runtime applier.
export function themeToCssVars(colors: ThemeColors): Record<string, string> {
  return {
    '--bg-base': colors.bgBase,
    '--bg-raised': colors.bgRaised,
    '--bg-elevated': colors.bgElevated,
    '--border': colors.border,
    '--border-hover': colors.borderHover,
    '--accent': colors.accent,
    '--accent-dim': hexToRgba(colors.accent, 0.08),
    '--accent-glow': hexToRgba(colors.accent, 0.2),
    '--success': colors.success,
    '--error': colors.error,
    '--error-dim': hexToRgba(colors.error, 0.1),
    '--warning': colors.warning,
    '--text-primary': colors.textPrimary,
    '--text-secondary': colors.textSecondary,
    '--text-dim': colors.textDim,
    '--nav-bg': darken(colors.bgBase, 0.25),
  };
}

export function applyThemeVars(colors: ThemeColors): void {
  const vars = themeToCssVars(colors);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}
