import './globals.css';
import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { Providers } from '../components/Providers';
import { Rajdhani, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { PREDEFINED_THEMES } from '@/types/theme';

// Applies the stored theme's CSS vars before first paint, so there's no
// flash of the default theme before AppThemeProvider's effect runs on the
// client — see ThemeContext.tsx. Theme *data* (PREDEFINED_THEMES) is
// serialized in server-side rather than duplicated as a literal here, so
// there's one source of truth for the actual palette values. Custom themes
// live in config.json now (not localStorage) — this script can't reach them
// synchronously, so it only matches against predefined themes here; if the
// stored active id is a custom theme, this falls back to the default until
// AppThemeProvider's effect applies the real colors post-hydration (a brief
// flash of the default theme in that one case, not a bug).
function themeInitScript(): string {
  return `(function(){try{
    var themes = ${JSON.stringify(PREDEFINED_THEMES)};
    var activeId = localStorage.getItem('handymon-active-theme');
    var theme = themes.find(function(t){ return t.id === activeId; }) || themes[0];
    var c = theme.colors;
    function alpha(hex, a) {
      var m = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
      if (!m) return hex;
      var r = parseInt(m[1],16), g = parseInt(m[2],16), b = parseInt(m[3],16);
      return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
    }
    function darken(hex, amt) {
      var m = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
      if (!m) return hex;
      var f = 1 - amt;
      function h(n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'); }
      return '#' + h(parseInt(m[1],16)*f) + h(parseInt(m[2],16)*f) + h(parseInt(m[3],16)*f);
    }
    var s = document.documentElement.style;
    s.setProperty('--bg-base', c.bgBase);
    s.setProperty('--bg-raised', c.bgRaised);
    s.setProperty('--bg-elevated', c.bgElevated);
    s.setProperty('--border', c.border);
    s.setProperty('--border-hover', c.borderHover);
    s.setProperty('--accent', c.accent);
    s.setProperty('--accent-dim', alpha(c.accent, 0.08));
    s.setProperty('--accent-glow', alpha(c.accent, 0.2));
    s.setProperty('--success', c.success);
    s.setProperty('--error', c.error);
    s.setProperty('--error-dim', alpha(c.error, 0.1));
    s.setProperty('--warning', c.warning);
    s.setProperty('--text-primary', c.textPrimary);
    s.setProperty('--text-secondary', c.textSecondary);
    s.setProperty('--text-dim', c.textDim);
    s.setProperty('--nav-bg', darken(c.bgBase, 0.25));
  }catch(e){}})();`;
}

const rajdhani = Rajdhani({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-rajdhani',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HandyMon',
  description: 'Local control hub',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: the theme-init script below sets inline CSS
  // vars on <html> before React hydrates — an expected, deliberate mismatch,
  // not a real one (same pattern next-themes and similar libraries use).
  return (
    <html lang="en" className={`${rajdhani.variable} ${dmSans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body>
        <AppRouterCacheProvider>
          <Providers>
            {children}
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
