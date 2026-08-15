'use client';

import BoltIcon from '@mui/icons-material/Bolt';
import QrCode2Icon from '@mui/icons-material/QrCode2';

export function LoginScreen() {
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
        gap: '1.25rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            backgroundColor: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(59,130,246,0.4)', flexShrink: 0,
          }}>
            <BoltIcon style={{ fontSize: 20, color: 'white' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
              HANDYMON
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.06em', marginTop: 2 }}>
              DEVICE NOT PAIRED
            </div>
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: 'var(--border)' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <QrCode2Icon style={{ fontSize: 28, color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            This device isn't paired yet. On the host PC, open <strong style={{ color: 'var(--text-primary)' }}>Settings</strong> and tap <strong style={{ color: 'var(--text-primary)' }}>PAIR</strong> to generate a QR code, then scan it with this device.
          </p>
        </div>

        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          color: 'var(--text-dim)',
          lineHeight: 1.5,
        }}>
          Or visit <span style={{ color: 'var(--accent)' }}>localhost:44558/pair</span> on the host PC and scan the QR code shown there.
        </div>
      </div>
    </div>
  );
}
