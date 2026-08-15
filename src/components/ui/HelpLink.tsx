'use client';

import { Box } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

// Links out to the relevant section of the bundled help page (served over
// HTTP at /help so it's reachable from paired devices too, not just a local
// file on the host). data-help-ignore so it navigates normally even while
// tap-to-target help mode is active (see HelpModeContext).
export function HelpLink({ anchor, label = 'Setup guide' }: { anchor: string; label?: string }) {
  return (
    <Box
      component="a"
      href={`/help#${anchor}`}
      target="_blank"
      rel="noopener noreferrer"
      data-help-ignore
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.4,
        fontSize: '0.7rem', color: 'var(--accent)', textDecoration: 'none',
        '&:hover': { textDecoration: 'underline' },
      }}
    >
      <HelpOutlineIcon sx={{ fontSize: 13 }} />
      {label}
    </Box>
  );
}
