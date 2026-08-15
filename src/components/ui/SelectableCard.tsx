import { Box, CircularProgress, Tooltip } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LockIcon from '@mui/icons-material/Lock';
import { SvgIconComponent } from '@mui/icons-material';

export function SelectableCard({
  label,
  icon: Icon,
  isActive,
  isLoading,
  disabled = false,
  lockedReason,
  onClick,
}: {
  label: string;
  icon: SvgIconComponent;
  isActive: boolean;
  isLoading: boolean;
  disabled?: boolean;
  /** When set, the card renders dimmed with a lock badge + tooltip instead of
   *  just silently ignoring clicks — for permission-denied states specifically,
   *  distinct from a transient `disabled` (e.g. mid-action). */
  lockedReason?: string;
  onClick: () => void;
}) {
  const locked = !!lockedReason;
  const isDisabled = disabled || isLoading || locked;
  const card = (
    <Box
      onClick={!isDisabled ? onClick : undefined}
      sx={{
        display: 'flex', alignItems: 'center', gap: 2.5, px: 2.5, py: 2,
        borderRadius: '12px',
        border: `1px solid ${isActive ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
        backgroundColor: isActive ? 'rgba(59,130,246,0.06)' : 'var(--bg-raised)',
        cursor: isDisabled ? 'default' : 'pointer',
        opacity: locked ? 0.55 : 1,
        transition: 'all 0.18s ease', position: 'relative', overflow: 'hidden',
        '&:hover': !isDisabled ? {
          borderColor: isActive ? 'rgba(59,130,246,0.65)' : 'var(--border-hover)',
          backgroundColor: isActive ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.025)',
          transform: 'translateX(2px)',
        } : {},
      }}
    >
      {isActive && (
        <Box sx={{
          position: 'absolute', left: 0, top: '18%', bottom: '18%', width: 3,
          backgroundColor: 'var(--accent)', borderRadius: '0 3px 3px 0',
          boxShadow: '2px 0 8px var(--accent-glow)',
        }} />
      )}
      <Box sx={{
        width: 42, height: 42, borderRadius: '10px',
        backgroundColor: isActive ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.18s ease',
      }}>
        {isLoading
          ? <CircularProgress size={18} sx={{ color: 'var(--accent)' }} />
          : <Icon sx={{ fontSize: 21, color: isActive ? 'var(--accent)' : 'var(--text-dim)' }} />
        }
      </Box>
      <Box sx={{ flex: 1 }}>
        <Box sx={{
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem',
          letterSpacing: '0.06em',
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          transition: 'color 0.18s ease',
        }}>
          {label}
        </Box>
      </Box>
      {locked && <LockIcon sx={{ fontSize: 16, color: 'var(--text-dim)', flexShrink: 0 }} />}
      {isActive && !locked && <CheckCircleOutlineIcon sx={{ fontSize: 18, color: 'var(--accent)', flexShrink: 0 }} />}
    </Box>
  );

  return lockedReason ? <Tooltip title={lockedReason} arrow>{card}</Tooltip> : card;
}
