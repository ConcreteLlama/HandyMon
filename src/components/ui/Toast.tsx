'use client';

import { useEffect, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';

type Severity = 'error' | 'success' | 'info';
type Listener = (message: string, severity: Severity) => void;
let listener: Listener | null = null;

// Suppresses re-showing the *same* message while it's still recent. Without
// this, a persistent failure behind a polling query (e.g. every API call
// rejected while a device's clock is out of sync) would make the toast
// auto-hide after 5s and then immediately reappear on the next failed poll —
// not a flood (ToastHost is single-slot, not a queue), but a nag repeating
// every ~5s for as long as the underlying problem lasts. A genuinely
// different message (a new/different error) is never suppressed.
const REPEAT_SUPPRESS_MS = 15000;
let lastMessage: string | null = null;
let lastShownAt = 0;

// Fire-and-forget global toast — any component can call this without needing
// its own Snackbar plumbing. Primarily fed by the QueryClient's global
// mutation error handler (see Providers.tsx) so a failed action anywhere in
// the app (e.g. a permission-denied 403) always surfaces visibly instead of
// silently no-op'ing.
export function showToast(message: string, severity: Severity = 'error') {
  const now = Date.now();
  if (message === lastMessage && now - lastShownAt < REPEAT_SUPPRESS_MS) return;
  lastMessage = message;
  lastShownAt = now;
  listener?.(message, severity);
}

export function ToastHost() {
  const [msg, setMsg] = useState('');
  const [severity, setSeverity] = useState<Severity>('error');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    listener = (message, sev) => { setMsg(message); setSeverity(sev); setOpen(true); };
    return () => { listener = null; };
  }, []);

  return (
    <Snackbar
      open={open}
      autoHideDuration={5000}
      onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity={severity} onClose={() => setOpen(false)} variant="filled" sx={{ fontSize: '0.82rem' }}>
        {msg}
      </Alert>
    </Snackbar>
  );
}
