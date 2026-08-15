import { Box } from '@mui/material';

export function ToggleSwitch({ checked, onChange, size = 'md' }: {
  checked: boolean;
  onChange: () => void;
  size?: 'sm' | 'md';
}) {
  const w = size === 'md' ? 36 : 32;
  const h = size === 'md' ? 20 : 18;
  const pad = size === 'md' ? 2 : 1;
  const thumbSize = h - 2 * pad;

  return (
    <Box
      onClick={onChange}
      sx={{
        width: w, height: h, borderRadius: h / 2, cursor: 'pointer', flexShrink: 0,
        backgroundColor: checked ? 'var(--accent)' : 'var(--border)',
        position: 'relative', transition: 'background 0.2s',
        '&::after': {
          content: '""', position: 'absolute', top: pad,
          left: checked ? (w - thumbSize - pad) : pad,
          width: thumbSize, height: thumbSize,
          borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s',
        },
      }}
    />
  );
}
