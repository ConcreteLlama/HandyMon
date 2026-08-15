// The color surface every theme (built-in or custom) defines. Deliberately a
// flat hex-only shape — "dim"/"glow" alpha variants (--accent-dim,
// --accent-glow, --error-dim) are derived at apply-time (see theme-storage.ts)
// rather than stored, so a custom theme can't end up with a mismatched dim
// variant that doesn't visually relate to its base color. success/warning/
// error stay fixed across built-in themes (see PREDEFINED_THEMES) since they
// carry semantic meaning — only bg/border/accent/text vary by default, though
// a custom theme is free to override them too.
export type ThemeColors = {
  bgBase: string;
  bgRaised: string;
  bgElevated: string;
  border: string;
  borderHover: string;
  accent: string;
  success: string;
  error: string;
  warning: string;
  textPrimary: string;
  textSecondary: string;
  textDim: string;
};

export type ThemePreset = {
  id: string;
  name: string;
  colors: ThemeColors;
};

const SEMANTIC = { success: '#34d399', error: '#f87171', warning: '#fbbf24' };
// Dark-theme semantic colors are tuned to pop against a near-black
// background; on a light background the same hues read as washed-out, so
// the light themes use darker/more saturated shades of the same three hues.
const SEMANTIC_LIGHT = { success: '#16a34a', error: '#dc2626', warning: '#b45309' };

export const PREDEFINED_THEMES: ThemePreset[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      bgBase: '#0d1117', bgRaised: '#161b27', bgElevated: '#1c2333',
      border: '#1e2533', borderHover: '#2a3549',
      accent: '#3b82f6',
      textPrimary: '#e2e8f0', textSecondary: '#94a3b8', textDim: '#707d98',
      ...SEMANTIC,
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    colors: {
      bgBase: '#120e0a', bgRaised: '#1d1712', bgElevated: '#241c15',
      border: '#2b2318', borderHover: '#3d3220',
      accent: '#fb923c',
      textPrimary: '#f1e9df', textSecondary: '#a89985', textDim: '#8b7960',
      ...SEMANTIC,
    },
  },
  {
    id: 'verdant',
    name: 'Verdant',
    colors: {
      bgBase: '#0a120d', bgRaised: '#121d16', bgElevated: '#18241c',
      border: '#1c2b21', borderHover: '#243d2f',
      accent: '#22c55e',
      textPrimary: '#e0f0e6', textSecondary: '#8fa89b', textDim: '#678377',
      ...SEMANTIC,
    },
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    colors: {
      bgBase: '#100a14', bgRaised: '#1a1220', bgElevated: '#221828',
      border: '#2a1e33', borderHover: '#3a2a47',
      accent: '#a855f7',
      textPrimary: '#ede4f5', textSecondary: '#a494b3', textDim: '#857498',
      ...SEMANTIC,
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    colors: {
      bgBase: '#14090e', bgRaised: '#1f1017', bgElevated: '#28151f',
      border: '#331b26', borderHover: '#472536',
      accent: '#ec4899',
      textPrimary: '#f5e2ea', textSecondary: '#b391a0', textDim: '#94707e',
      ...SEMANTIC,
    },
  },
  {
    id: 'daylight',
    name: 'Daylight',
    colors: {
      bgBase: '#f6f7f9', bgRaised: '#ffffff', bgElevated: '#eef1f5',
      border: '#dde1e8', borderHover: '#c5cbd6',
      accent: '#2563eb',
      textPrimary: '#0f172a', textSecondary: '#475569', textDim: '#64748b',
      ...SEMANTIC_LIGHT,
    },
  },
  {
    id: 'linen',
    name: 'Linen',
    colors: {
      bgBase: '#faf7f2', bgRaised: '#ffffff', bgElevated: '#f1ebe0',
      border: '#ddd3c0', borderHover: '#c7b99f',
      accent: '#b45309',
      textPrimary: '#2b2118', textSecondary: '#5c5040', textDim: '#8a7d67',
      ...SEMANTIC_LIGHT,
    },
  },
];

export const DEFAULT_THEME_ID = PREDEFINED_THEMES[0].id;
