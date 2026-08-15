'use client';

import { useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ClearIcon from '@mui/icons-material/Clear';
import CheckIcon from '@mui/icons-material/Check';
import { useTypeText, useSendKey } from '@/hooks/keyboard/useKeyboard';
import { useAppConfig } from '@/hooks/config/useAppConfig';
import { useExecuteAction } from '@/hooks/actions/useExecuteAction';
import type { SequenceStep } from '@/types/app-config';
import { helpProps } from '@/components/help/HelpModeContext';

const MAX = 10_000;

// ── Key button ─────────────────────────────────────────────────────────────

function Key({ label, sub, keys, onSend, busy, sx }: {
  label: string; sub?: string; keys: string[];
  onSend: (k: string[]) => void; busy: boolean;
  sx?: object;
}) {
  return (
    <Box
      onClick={!busy ? () => onSend(keys) : undefined}
      sx={[{
        minHeight: 34,
        px: 0.6, py: 0.55,
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '3px solid rgba(0,0,0,0.55)',
        background: 'linear-gradient(180deg, #222839 0%, #181d2c 100%)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.72rem',
        lineHeight: 1.25,
        cursor: busy ? 'default' : 'pointer',
        userSelect: 'none',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.08s',
        '&:hover': !busy ? {
          color: 'var(--accent)',
          borderColor: 'rgba(59,130,246,0.3)',
          borderBottomColor: 'rgba(59,130,246,0.5)',
          background: 'linear-gradient(180deg, #1e2840 0%, #141b2e 100%)',
        } : {},
        '&:active': !busy ? { transform: 'translateY(1px)', borderBottomWidth: '1px' } : {},
      }, sx ?? {}]}
    >
      <Box>{label}</Box>
      {sub && <Box sx={{ fontSize: '0.55rem', color: 'var(--text-dim)', mt: 0.15 }}>{sub}</Box>}
    </Box>
  );
}

function KbdLabel({ children }: { children: string }) {
  return (
    <Box sx={{
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.6rem',
      letterSpacing: '0.1em', color: 'var(--border)', mb: 0.6,
    }}>
      {children}
    </Box>
  );
}

// ── Key chip (for hotkey display) ─────────────────────────────────────────

function KeyChip({ k }: { k: string }) {
  return (
    <Box sx={{
      px: 0.6, py: 0.1, borderRadius: '4px',
      border: '1px solid var(--border)',
      borderBottom: '2px solid rgba(0,0,0,0.4)',
      backgroundColor: 'var(--bg-elevated)',
      fontFamily: 'var(--font-mono)', fontSize: '0.63rem',
      color: 'var(--text-secondary)', lineHeight: 1.5, flexShrink: 0,
    }}>
      {k}
    </Box>
  );
}

// ── Section key data ───────────────────────────────────────────────────────

const EDIT_KEYS = [
  { label: 'Ctrl+A', sub: 'All',   keys: ['Ctrl', 'A'] },
  { label: 'Ctrl+C', sub: 'Copy',  keys: ['Ctrl', 'C'] },
  { label: 'Ctrl+X', sub: 'Cut',   keys: ['Ctrl', 'X'] },
  { label: 'Ctrl+V', sub: 'Paste', keys: ['Ctrl', 'V'] },
  { label: 'Ctrl+Z', sub: 'Undo',  keys: ['Ctrl', 'Z'] },
  { label: 'Ctrl+Y', sub: 'Redo',  keys: ['Ctrl', 'Y'] },
  { label: 'Ctrl+S', sub: 'Save',  keys: ['Ctrl', 'S'] },
  { label: 'Ctrl+F', sub: 'Find',  keys: ['Ctrl', 'F'] },
  { label: 'Ctrl+W', sub: 'Close', keys: ['Ctrl', 'W'] },
  { label: 'Ctrl+T', sub: 'New Tab',keys: ['Ctrl', 'T'] },
  { label: 'Ctrl+N', sub: 'New',   keys: ['Ctrl', 'N'] },
  { label: 'Ctrl+P', sub: 'Print', keys: ['Ctrl', 'P'] },
];

const WIN_KEYS = [
  { label: 'Win',     sub: 'Start',     keys: ['Win'] },
  { label: 'Win+Tab', sub: 'Task View', keys: ['Win', 'Tab'] },
  { label: 'Win+L',   sub: 'Lock',      keys: ['Win', 'L'] },
  { label: 'Win+D',   sub: 'Desktop',   keys: ['Win', 'D'] },
  { label: 'Win+E',   sub: 'Explorer',  keys: ['Win', 'E'] },
  { label: 'Win+R',   sub: 'Run',       keys: ['Win', 'R'] },
  { label: 'Win+S',   sub: 'Search',    keys: ['Win', 'S'] },
  { label: 'Win+I',   sub: 'Settings',  keys: ['Win', 'I'] },
];

const ALT_KEYS = [
  { label: 'Alt+Tab',   sub: 'Switch',      keys: ['Alt', 'Tab'] },
  { label: 'Alt+F4',    sub: 'Close',       keys: ['Alt', 'F4'] },
  { label: 'Alt+Enter', sub: 'Properties',  keys: ['Alt', 'Enter'] },
  { label: 'Alt+Space', sub: 'Sys Menu',    keys: ['Alt', 'Space'] },
];

const MEDIA_KEYS = [
  { label: '🔇', sub: 'Mute',  keys: ['VolumeMute'] },
  { label: '🔉', sub: 'Vol −', keys: ['VolumeDown'] },
  { label: '🔊', sub: 'Vol +', keys: ['VolumeUp'] },
  { label: '⏮',  sub: 'Prev',  keys: ['MediaPrev'] },
  { label: '⏯',  sub: 'Play',  keys: ['MediaPlayPause'] },
  { label: '⏭',  sub: 'Next',  keys: ['MediaNext'] },
];

const F_KEYS = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];

// ── Main component ─────────────────────────────────────────────────────────

export function VirtualKeyboardSection() {
  const [text, setText] = useState('');
  const [clearAfterSend, setClearAfterSend] = useState(true);
  const [sendStatus, setSendStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const { mutate: typeText, isPending: typePending } = useTypeText();
  const { mutate: sendKey, isPending: keyPending } = useSendKey();
  const { mutate: execAction } = useExecuteAction();
  const { data: config } = useAppConfig();
  const busy = typePending || keyPending;

  // A "hotkey action" is now just a 1-step sequence whose only step is a
  // hotkey — there's no separate top-level Hotkey action type anymore.
  const hotkeyActions = (config?.actions ?? [])
    .filter(a => a.steps.length === 1 && a.steps[0].type === 'hotkey')
    .map(a => ({ id: a.id, name: a.name, keys: (a.steps[0] as Extract<SequenceStep, { type: 'hotkey' }>).keys }));

  function handleSend() {
    if (!text.trim() || busy) return;
    setSendStatus('idle');
    typeText(text, {
      onSuccess: () => { setSendStatus('ok'); if (clearAfterSend) setText(''); setTimeout(() => setSendStatus('idle'), 2000); },
      onError:   () => { setSendStatus('error'); setTimeout(() => setSendStatus('idle'), 3000); },
    });
  }

  function handleKey(keys: string[]) { if (!busy) sendKey(keys); }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSend(); }
  }

  const overLimit = text.length > MAX;

  // Shorthand for key buttons in this component
  const K = ({ label, sub, keys, sx }: { label: string; sub?: string; keys: string[]; sx?: object }) => (
    <Key label={label} sub={sub} keys={keys} onSend={handleKey} busy={busy} sx={sx} />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Type text ─────────────────────────────────────────────────── */}
      <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.88rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>TYPE TEXT</Box>
          <Box sx={{ fontSize: '0.68rem', color: overLimit ? 'var(--error)' : 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{text.length} / {MAX.toLocaleString()}</Box>
        </Box>
        <textarea
          value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Type or paste text here… it will be sent to the focused app on the host PC"
          rows={5} disabled={busy}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '0.75rem',
            backgroundColor: 'var(--bg-base)',
            border: `1px solid ${overLimit ? 'var(--error)' : 'var(--border)'}`,
            borderRadius: 8, color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: 1.5,
            resize: 'vertical', outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => { if (!overLimit) e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = overLimit ? 'var(--error)' : 'var(--border)'; }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer' }}
            onClick={() => setClearAfterSend(v => !v)}
            {...helpProps('Clear After Send', "Empties the text box once it's successfully sent, so it's ready for the next thing without a manual clear.")}
          >
            <Box sx={{ width: 32, height: 18, borderRadius: 9, flexShrink: 0, backgroundColor: clearAfterSend ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', '&::after': { content: '""', position: 'absolute', top: 1, left: clearAfterSend ? 14 : 1, width: 16, height: 16, borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s' } }} />
            <Box sx={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.04em' }}>CLEAR AFTER SEND</Box>
          </Box>
          <Box sx={{ flex: 1 }} />
          {text && (
            <Box onClick={() => { setText(''); setSendStatus('idle'); }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.65, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.78rem', '&:hover': { borderColor: 'var(--error)', color: 'var(--error)' }, transition: 'all 0.15s' }}>
              <ClearIcon sx={{ fontSize: 14 }} />CLEAR
            </Box>
          )}
          <Box
            onClick={!busy && text.trim() && !overLimit ? handleSend : undefined}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, px: 2, py: 0.65, borderRadius: 7,
              backgroundColor: sendStatus === 'ok' ? 'rgba(52,211,153,0.15)' : sendStatus === 'error' ? 'rgba(248,113,113,0.15)' : (!text.trim() || overLimit || busy) ? 'rgba(59,130,246,0.2)' : 'var(--accent)',
              border: `1px solid ${sendStatus === 'ok' ? 'rgba(52,211,153,0.4)' : sendStatus === 'error' ? 'rgba(248,113,113,0.4)' : 'transparent'}`,
              color: sendStatus === 'ok' ? 'var(--success)' : sendStatus === 'error' ? 'var(--error)' : (!text.trim() || overLimit || busy) ? 'rgba(255,255,255,0.35)' : 'white',
              cursor: (!text.trim() || overLimit || busy) ? 'default' : 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.06em', transition: 'all 0.15s',
            }}
          >
            {typePending ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : sendStatus === 'ok' ? <CheckIcon sx={{ fontSize: 15 }} /> : <SendIcon sx={{ fontSize: 14 }} />}
            {typePending ? 'SENDING…' : sendStatus === 'ok' ? 'SENT' : sendStatus === 'error' ? 'FAILED' : 'SEND'}
          </Box>
        </Box>
        {sendStatus === 'error' && (
          <Box sx={{ px: 1.5, py: 1, borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', fontSize: '0.75rem', color: 'var(--error)' }}>
            Failed to send — make sure a window has focus on the host PC.
          </Box>
        )}
        <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Sent to whichever window has focus on the host PC. Use Ctrl+Enter to send quickly.
        </Box>
      </Box>

      {/* ── Quick keys ────────────────────────────────────────────────── */}
      <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.88rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>QUICK KEYS</Box>

        {/* ESSENTIAL */}
        <Box>
          <KbdLabel>ESSENTIAL</KbdLabel>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1.8fr 1fr 1fr', gap: 0.5 }}>
              <K label="Esc" keys={['Escape']} />
              <K label="Tab ⇥" keys={['Tab']} />
              <K label="⌫  Backspace" keys={['Backspace']} />
              <K label="Del" keys={['Delete']} />
              <K label="Ins" keys={['Insert']} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 0.5 }}>
              <K label="↵  Enter" keys={['Enter']} />
              <K label="Space" keys={['Space']} />
            </Box>
          </Box>
        </Box>

        {/* MODIFIERS */}
        <Box>
          <KbdLabel>MODIFIERS</KbdLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5 }}>
            <K label="Ctrl" keys={['Ctrl']} />
            <K label="Alt" keys={['Alt']} />
            <K label="Shift" keys={['Shift']} />
            <K label="Win" keys={['Win']} />
            <K label="Caps" sub="Lock" keys={['CapsLock']} />
          </Box>
        </Box>

        {/* NAVIGATION — arrow inverted-T + page nav */}
        <Box>
          <KbdLabel>NAVIGATION</KbdLabel>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
            {/* Inverted-T arrow layout */}
            <Box sx={{
              display: 'grid',
              gridTemplateAreas: '". up ." "left down right"',
              gridTemplateColumns: 'repeat(3, 38px)',
              gridTemplateRows: 'repeat(2, 34px)',
              gap: '4px',
              flexShrink: 0,
            }}>
              <Box sx={{ gridArea: 'up' }}>    <K label="↑" keys={['Up']} /></Box>
              <Box sx={{ gridArea: 'left' }}>  <K label="←" keys={['Left']} /></Box>
              <Box sx={{ gridArea: 'down' }}>  <K label="↓" keys={['Down']} /></Box>
              <Box sx={{ gridArea: 'right' }}> <K label="→" keys={['Right']} /></Box>
            </Box>
            {/* Page / home cluster */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', flex: 1 }}>
              <K label="PgUp" keys={['PageUp']} />
              <K label="Home" keys={['Home']} />
              <K label="PgDn" keys={['PageDown']} />
              <K label="End"  keys={['End']} />
            </Box>
          </Box>
        </Box>

        {/* FUNCTION KEYS */}
        <Box>
          <KbdLabel>FUNCTION</KbdLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.5 }}>
            {F_KEYS.map(f => <K key={f} label={f} keys={[f]} />)}
          </Box>
        </Box>

        {/* EDIT SHORTCUTS */}
        <Box>
          <KbdLabel>EDIT</KbdLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
            {EDIT_KEYS.map(k => <K key={k.label} label={k.label} sub={k.sub} keys={k.keys} />)}
          </Box>
        </Box>

        {/* ALT SHORTCUTS */}
        <Box>
          <KbdLabel>ALT</KbdLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
            {ALT_KEYS.map(k => <K key={k.label} label={k.label} sub={k.sub} keys={k.keys} />)}
          </Box>
        </Box>

        {/* WINDOWS SHORTCUTS */}
        <Box>
          <KbdLabel>WINDOWS</KbdLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
            {WIN_KEYS.map(k => <K key={k.label} label={k.label} sub={k.sub} keys={k.keys} />)}
          </Box>
        </Box>

        {/* MEDIA */}
        <Box>
          <KbdLabel>MEDIA</KbdLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.5 }}>
            {MEDIA_KEYS.map(k => <K key={k.label} label={k.label} sub={k.sub} keys={k.keys} />)}
          </Box>
        </Box>
      </Box>

      {/* ── Action hotkeys ────────────────────────────────────────────── */}
      {hotkeyActions.length > 0 && (
        <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.88rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>HOTKEYS</Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 0.75 }}>
            {hotkeyActions.map(m => (
              <Box
                key={m.id}
                onClick={() => execAction(m.id)}
                sx={{
                  p: 1, borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderBottom: '3px solid rgba(0,0,0,0.55)',
                  background: 'linear-gradient(180deg, #222839 0%, #181d2c 100%)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 0.6,
                  transition: 'all 0.08s',
                  '&:hover': { borderColor: 'rgba(59,130,246,0.3)', borderBottomColor: 'rgba(59,130,246,0.5)', background: 'linear-gradient(180deg, #1e2840 0%, #141b2e 100%)' },
                  '&:active': { transform: 'translateY(1px)', borderBottomWidth: '1px' },
                }}
              >
                <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.name}
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, alignItems: 'center' }}>
                  {m.keys.map((k, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      {i > 0 && <Box sx={{ fontSize: '0.55rem', color: 'var(--text-dim)' }}>+</Box>}
                      <KeyChip k={k} />
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

    </Box>
  );
}
