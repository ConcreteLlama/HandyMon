import { Box } from '@mui/material';
import { helpProps } from '@/components/help/HelpModeContext';

// `hint` is always-visible small print under the label; `help` is a longer
// explanation surfaced on tap via help mode instead — use `hint` for a short
// always-relevant caveat, `help` for something worth explaining but too long
// to show inline everywhere this label appears.
export function FormLabel({ children, hint, help, helpTitle: helpTitleOverride }: { children: React.ReactNode; hint?: string; help?: string; helpTitle?: string }) {
  const helpTitle = helpTitleOverride ?? (typeof children === 'string' ? children : 'Info');
  return (
    <Box sx={{ mb: 0.4 }}>
      <Box
        {...(help ? helpProps(helpTitle, help) : {})}
        sx={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-dim)' }}
      >
        {children}
      </Box>
      {hint && (
        <Box sx={{ fontSize: '0.63rem', color: 'var(--text-dim)', opacity: 0.7, mt: 0.1 }}>
          {hint}
        </Box>
      )}
    </Box>
  );
}
