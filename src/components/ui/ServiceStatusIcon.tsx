import { Box } from '@mui/material';
import { SvgIconComponent } from '@mui/icons-material';

export function ServiceStatusIcon({
  icon: Icon,
  isRunning,
  statusColor,
}: {
  icon: SvgIconComponent;
  isRunning: boolean;
  statusColor: string;
}) {
  return (
    <Box sx={{
      width: 48, height: 48, borderRadius: '12px',
      backgroundColor: isRunning ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, position: 'relative', transition: 'background 0.3s ease',
    }}>
      <Icon sx={{ fontSize: 22, color: isRunning ? 'var(--success)' : 'var(--text-dim)', transition: 'color 0.3s ease' }} />
      <Box sx={{
        position: 'absolute', top: 7, right: 7, width: 8, height: 8,
        borderRadius: '50%', backgroundColor: statusColor,
        boxShadow: isRunning ? '0 0 6px var(--success)' : 'none',
        transition: 'all 0.3s ease',
      }} />
    </Box>
  );
}
