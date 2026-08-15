import { Box, CircularProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';

export function ServiceToggleButton({
  isRunning,
  isPending,
  onToggle,
}: {
  isRunning: boolean;
  isPending: boolean;
  onToggle: () => void;
}) {
  return (
    <Box
      onClick={() => !isPending && onToggle()}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, px: 2.25, py: 1.1,
        borderRadius: '8px',
        border: `1px solid ${isRunning ? 'rgba(248,113,113,0.3)' : 'rgba(52,211,153,0.3)'}`,
        backgroundColor: isRunning ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)',
        color: isRunning ? 'var(--error)' : 'var(--success)',
        cursor: isPending ? 'default' : 'pointer',
        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.05em',
        transition: 'all 0.15s ease', flexShrink: 0,
        '&:hover': !isPending ? {
          backgroundColor: isRunning ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.12)',
        } : {},
      }}
    >
      {isPending ? (
        <CircularProgress size={15} sx={{ color: 'inherit' }} />
      ) : isRunning ? (
        <><StopIcon sx={{ fontSize: 15 }} />STOP</>
      ) : (
        <><PlayArrowIcon sx={{ fontSize: 15 }} />START</>
      )}
    </Box>
  );
}
