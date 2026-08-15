import { createTheme } from '@mui/material/styles';
import type { ThemeColors } from '@/types/theme';

function alpha(hex: string, a: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const [r, g, b] = m.slice(1).map(x => parseInt(x, 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// MUI's own components (Dialog, Switch, Slider, OutlinedInput, ...) are
// styled via this palette/component-overrides object rather than the raw
// var(--...) CSS custom properties the rest of the app's own sx styling
// uses directly — the two are deliberately kept in sync by both reading
// from the same ThemeColors input (see AppThemeProvider in ThemeContext.tsx),
// rather than duplicating hardcoded hex in two places like before theming
// existed.
export function createAppTheme(colors: ThemeColors) {
  return createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: colors.bgBase,
      paper: colors.bgRaised,
    },
    primary: {
      main: colors.accent,
    },
    secondary: {
      main: '#f97316',
    },
    success: {
      main: colors.success,
    },
    error: {
      main: colors.error,
    },
    warning: {
      main: colors.warning,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.textDim,
    },
    divider: colors.border,
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: 'var(--font-dm-sans, "DM Sans"), system-ui, sans-serif',
    h1: { fontFamily: 'var(--font-rajdhani, "Rajdhani"), sans-serif', fontWeight: 700, letterSpacing: '0.02em' },
    h2: { fontFamily: 'var(--font-rajdhani, "Rajdhani"), sans-serif', fontWeight: 700, letterSpacing: '0.02em' },
    h3: { fontFamily: 'var(--font-rajdhani, "Rajdhani"), sans-serif', fontWeight: 600, letterSpacing: '0.02em' },
    h4: { fontFamily: 'var(--font-rajdhani, "Rajdhani"), sans-serif', fontWeight: 600, letterSpacing: '0.02em' },
    h5: { fontFamily: 'var(--font-rajdhani, "Rajdhani"), sans-serif', fontWeight: 600, letterSpacing: '0.02em' },
    h6: { fontFamily: 'var(--font-rajdhani, "Rajdhani"), sans-serif', fontWeight: 600, letterSpacing: '0.02em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundImage: 'none' } },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${colors.border}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          letterSpacing: '0.01em',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.borderHover },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.accent },
        },
        input: { color: colors.textPrimary },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: colors.textSecondary },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: alpha(colors.accent, 0.08) },
          '&.Mui-selected': {
            backgroundColor: alpha(colors.accent, 0.12),
            '&:hover': { backgroundColor: alpha(colors.accent, 0.16) },
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: { color: colors.accent },
        track: { border: 'none' },
        rail: { backgroundColor: colors.borderHover, opacity: 1 },
        thumb: {
          width: 14,
          height: 14,
          '&::before': { display: 'none' },
          '&:hover, &.Mui-focusVisible': {
            boxShadow: `0 0 0 6px ${alpha(colors.accent, 0.15)}`,
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: colors.accent,
            '& + .MuiSwitch-track': { backgroundColor: colors.accent, opacity: 0.4 },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.bgRaised,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--font-rajdhani, "Rajdhani"), sans-serif',
          fontWeight: 600,
          letterSpacing: '0.04em',
        },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: colors.border } },
    },
    MuiAlert: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        standardError: {
          backgroundColor: alpha(colors.error, 0.08),
          color: colors.error,
          border: `1px solid ${alpha(colors.error, 0.25)}`,
        },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: { color: colors.accent },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: colors.textSecondary },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: { backgroundColor: colors.bgElevated, border: `1px solid ${colors.border}` },
        option: {
          '&:hover': { backgroundColor: `${alpha(colors.accent, 0.08)} !important` },
          '&[aria-selected="true"]': { backgroundColor: `${alpha(colors.accent, 0.12)} !important` },
        },
      },
    },
  },
  });
}
