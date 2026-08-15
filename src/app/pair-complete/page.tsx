'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import BoltIcon from '@mui/icons-material/Bolt';
import { generateAndStoreKeyPair } from '@/utils/request-signing-client';

type Status = 'working' | 'error' | 'done';

// Landing point for the pairing QR code — deliberately a page (not a plain
// API redirect like the old auto-login flow) because generating the
// device's keypair has to happen client-side: the private key is created
// here, on-device, and never sent anywhere. Only the exported public key
// goes to the server, via /api/auth/complete-pairing.
export default function PairCompletePage() {
  return (
    <Suspense fallback={null}>
      <PairCompleteBody />
    </Suspense>
  );
}

function PairCompleteBody() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>('working');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setError('Missing pairing token — ask the host to generate a new QR code.');
      return;
    }

    // Token format is <deviceId>.<hmac> (see devices.ts) — the deviceId
    // prefix is not sensitive on its own (it's meaningless without a valid
    // signature to go with it), so parsing it out client-side to key the
    // stored keypair is fine.
    const dot = token.lastIndexOf('.');
    const deviceId = dot >= 0 ? token.slice(0, dot) : null;
    if (!deviceId) {
      setStatus('error');
      setError('Malformed pairing token — ask the host to generate a new QR code.');
      return;
    }

    (async () => {
      try {
        const publicKeyJwk = await generateAndStoreKeyPair(deviceId);
        const res = await fetch('/api/auth/complete-pairing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, publicKeyJwk }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setStatus('error');
          setError(data.error || 'Pairing failed — ask the host to generate a new QR code.');
          return;
        }
        setStatus('done');
        window.location.href = '/';
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Pairing failed.');
      }
    })();
  }, [params]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-base)',
      padding: '1.5rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 360,
        backgroundColor: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.25rem',
        textAlign: 'center',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          backgroundColor: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 14px rgba(59,130,246,0.4)',
        }}>
          <BoltIcon style={{ fontSize: 20, color: 'white' }} />
        </div>

        {status === 'error' ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--error)', lineHeight: 1.6 }}>{error}</div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {status === 'done' ? 'Paired — loading…' : 'Completing pairing…'}
          </div>
        )}
      </div>
    </div>
  );
}
