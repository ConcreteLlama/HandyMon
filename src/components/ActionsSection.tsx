'use client';

import { createPortal } from 'react-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import MonitorIcon from '@mui/icons-material/Monitor';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import AirIcon from '@mui/icons-material/Air';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import AppsIcon from '@mui/icons-material/Apps';
import ViewListIcon from '@mui/icons-material/ViewList';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Action, ActionGroup, ActionPage, SequenceStep, KeySequenceEvent, ConfiguredAudioDevice } from '@/types/app-config';
import SouthIcon from '@mui/icons-material/South';
import NorthIcon from '@mui/icons-material/North';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { FileBrowserDialog } from './FileBrowserDialog';
import { InstalledAppsDialog } from './InstalledAppsDialog';
import { RunningProcessDialog } from './RunningProcessDialog';
import { toKebabId } from '@/utils/id';
import { apiFetch } from '@/utils/api-client';
import { useAppConfig, useUpdateAppConfig, useDisplayProfiles } from '@/hooks/config/useAppConfig';
import { useExecuteAction } from '@/hooks/actions/useExecuteAction';
import { useFanProfiles } from '@/hooks/fan-control/useFanProfiles';
import { useIsLocalhost } from '@/hooks/useIsLocalhost';
import { fieldStyle } from '@/components/ui/fieldStyle';
import { FormLabel } from '@/components/ui/FormLabel';
import { DialogHeader } from '@/components/ui/DialogHeader';
import { DialogButtons } from '@/components/ui/DialogButtons';
import { ModalShell } from '@/components/ui/ModalShell';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { SwipeableTabs } from '@/components/ui/SwipeableTabs';
import { useGrants } from '@/hooks/auth/useGrants';
import { showToast } from '@/components/ui/Toast';
import DeleteIcon from '@mui/icons-material/Delete';
import { helpProps } from '@/components/help/HelpModeContext';
import { tipProps } from '@/components/onboarding/tips';

// ── Key catalogue ─────────────────────────────────────────────────────────────

const KEY_GROUPS = [
  { label: 'Modifiers',  keys: ['Ctrl','Alt','Shift','Win','LCtrl','RCtrl','LAlt','RAlt','LShift','RShift','LWin','RWin'] },
  { label: 'Common',     keys: ['Escape','Enter','Tab','Space','Backspace','Delete','Insert'] },
  { label: 'Navigation', keys: ['Up','Down','Left','Right','Home','End','PageUp','PageDown'] },
  { label: 'Function',   keys: ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16'] },
  { label: 'Letters',    keys: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
  { label: 'Numbers',    keys: '0123456789'.split('') },
  { label: 'Numpad',     keys: ['Numpad0','Numpad1','Numpad2','Numpad3','Numpad4','Numpad5','Numpad6','Numpad7','Numpad8','Numpad9','NumpadAdd','NumpadSubtract','NumpadMultiply','NumpadDivide','NumpadDecimal'] },
  { label: 'System',     keys: ['PrintScreen','ScrollLock','Pause','CapsLock','NumLock','Sleep'] },
  { label: 'Media',      keys: ['VolumeUp','VolumeDown','VolumeMute','MediaPlayPause','MediaNext','MediaPrev','MediaStop'] },
  { label: 'Browser',    keys: ['BrowserBack','BrowserForward','BrowserRefresh'] },
];
const ALL_KEYS = KEY_GROUPS.flatMap(g => g.keys);

// ── Shared helpers ────────────────────────────────────────────────────────────

function comboLabel(keys: string[]) { return keys.join(' + '); }

function KeyChip({ k, onRemove }: { k: string; onRemove?: () => void }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.75, py: 0.15, borderRadius: '5px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.6, flexShrink: 0 }}>
      {k}
      {onRemove && <CloseIcon onClick={onRemove} sx={{ fontSize: 10, cursor: 'pointer', opacity: 0.6, '&:hover': { opacity: 1, color: 'var(--error)' } }} />}
    </Box>
  );
}


// ── Shared key-picker dropdown ──────────────────────────────────────────────
// Backs both KeyComboInput (Hotkey — multi-select, chips) and KeyPicker
// (Key Sequence's per-event key — single-select). Browsing with an empty
// query shows the full key list organized into KEY_GROUPS' sections (easy
// to scan when you don't know exactly what you're looking for); typing
// switches to a flat, ranked list instead — exact match, then prefix, then
// substring — since re-grouping while filtering buried single-letter exact
// matches (e.g. "R") under unrelated group matches like "RCtrl"/"Right",
// which is the exact bug that motivated ranking in the first place.

const DROP_MAX_H = 220;

type KeyFilterResult =
  | { mode: 'grouped'; groups: { label: string; keys: string[] }[] }
  | { mode: 'flat'; keys: string[] };

function filterKeys(query: string, exclude: string[] = []): KeyFilterResult {
  const q = query.trim().toLowerCase();
  if (!q) {
    const groups = KEY_GROUPS
      .map(g => ({ label: g.label, keys: g.keys.filter(k => !exclude.includes(k)) }))
      .filter(g => g.keys.length > 0);
    return { mode: 'grouped', groups };
  }
  const candidates = ALL_KEYS.filter(k => k.toLowerCase().includes(q) && !exclude.includes(k));
  const rank = (k: string) => {
    const kl = k.toLowerCase();
    if (kl === q) return 0;
    if (kl.startsWith(q)) return 1;
    return 2;
  };
  return { mode: 'flat', keys: [...candidates].sort((a, b) => rank(a) - rank(b)) };
}

function keyFilterHasResults(result: KeyFilterResult): boolean {
  return result.mode === 'flat' ? result.keys.length > 0 : result.groups.length > 0;
}

// Positioning + open/close for the dropdown portal — shared so both pickers
// flip above/below the same way and close the same way (click outside).
function useKeyDropdown(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [open, setOpen] = useState(false);
  const [dropRect, setDropRect] = useState<{ top: number; bottom: number; left: number; width: number } | null>(null);

  function measureAndOpen() {
    if (containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setDropRect({ top: r.bottom + 4, bottom: r.top - 4, left: r.left, width: r.width });
    }
    setOpen(true);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [containerRef]);

  const spaceBelow = dropRect ? window.innerHeight - dropRect.top : 0;
  const showAbove = !!dropRect && spaceBelow < DROP_MAX_H && dropRect.bottom > DROP_MAX_H;
  const dropStyle: React.CSSProperties = dropRect ? {
    position: 'fixed', left: dropRect.left, width: dropRect.width,
    ...(showAbove
      ? { bottom: window.innerHeight - dropRect.bottom, maxHeight: Math.min(DROP_MAX_H, dropRect.bottom - 8) }
      : { top: dropRect.top, maxHeight: Math.min(DROP_MAX_H, spaceBelow - 8) }),
  } : {};

  return { open, setOpen, dropRect, dropStyle, measureAndOpen };
}

function KeyOptionRow({ k, onPick }: { k: string; onPick: (k: string) => void }) {
  return (
    <Box onMouseDown={e => { e.preventDefault(); onPick(k); }} sx={{ px: 1.5, py: 0.65, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', '&:hover': { backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' } }}>
      {k}
    </Box>
  );
}

function KeyDropdownList({ result, onPick, style, resetKey }: { result: KeyFilterResult; onPick: (k: string) => void; style: React.CSSProperties; resetKey: string }) {
  // Scrolled down browsing groups, then typed a filter char? The list below
  // is now a totally different (usually much shorter) result set — jump
  // back to the top instead of leaving the scroll position wherever it was
  // in the old, longer list. Keyed on the query text specifically (not the
  // `result` object, which changes identity on every render regardless of
  // whether the query actually changed) so this doesn't fire on unrelated
  // re-renders while the user is scrolling.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [resetKey]);

  return (
    <Box ref={listRef} sx={{ ...style, backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', zIndex: 1360, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      {result.mode === 'grouped' ? result.groups.map(g => (
        <Box key={g.label}>
          <Box sx={{ position: 'sticky', top: 0, px: 1.5, py: 0.4, fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
            {g.label}
          </Box>
          {g.keys.map(k => <KeyOptionRow key={k} k={k} onPick={onPick} />)}
        </Box>
      )) : result.keys.map(k => <KeyOptionRow key={k} k={k} onPick={onPick} />)}
    </Box>
  );
}

// ── KeyComboInput ─────────────────────────────────────────────────────────────
// Hotkey's multi-select: chips + free-typed query, adds to the combo.

function KeyComboInput({ keys, onChange }: { keys: string[]; onChange: (keys: string[]) => void }) {
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { open, setOpen, dropRect, dropStyle, measureAndOpen } = useKeyDropdown(containerRef);
  const result = filterKeys(query, keys);

  function addKey(k: string) { onChange([...keys, k]); setQuery(''); inputRef.current?.focus(); }
  function removeKey(i: number) { onChange(keys.filter((_, idx) => idx !== i)); }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      const exact = ALL_KEYS.find(k => k.toLowerCase() === query.trim().toLowerCase());
      addKey(exact ?? query.trim()); e.preventDefault();
    } else if (e.key === 'Backspace' && !query && keys.length) {
      onChange(keys.slice(0, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <Box ref={containerRef}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, minHeight: 40, px: 0.75, py: 0.75, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'text', '&:focus-within': { borderColor: 'var(--accent)' }, transition: 'border-color 0.15s' }} onClick={() => { measureAndOpen(); inputRef.current?.focus(); }}>
        {keys.map((k, i) => <KeyChip key={i} k={k} onRemove={() => removeKey(i)} />)}
        <input ref={inputRef} value={query} placeholder={keys.length ? '' : 'Type to search, or browse below…'} onChange={e => { setQuery(e.target.value); measureAndOpen(); }} onFocus={measureAndOpen} onKeyDown={onKeyDown} style={{ flex: 1, minWidth: 100, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: 0 }} spellCheck={false} autoComplete="off" />
      </Box>
      {open && keyFilterHasResults(result) && dropRect && createPortal(
        <KeyDropdownList result={result} onPick={addKey} style={dropStyle} resetKey={query} />,
        document.body
      )}
    </Box>
  );
}

// ── KeyPicker ────────────────────────────────────────────────────────────────
// Key Sequence's single-select: shows the current key when idle, becomes a
// filterable text box while focused, picking an option closes the dropdown.
function KeyPicker({ value, onChange, width = 140 }: { value: string; onChange: (key: string) => void; width?: number }) {
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { open, setOpen, dropRect, dropStyle, measureAndOpen } = useKeyDropdown(containerRef);
  const result = filterKeys(query);

  function pick(k: string) { onChange(k); setQuery(''); setOpen(false); }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      const exact = ALL_KEYS.find(k => k.toLowerCase() === query.trim().toLowerCase());
      if (exact) pick(exact);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setQuery(''); setOpen(false); inputRef.current?.blur();
    }
  }

  return (
    <Box ref={containerRef} sx={{ width, flexShrink: 0 }}>
      <input
        ref={inputRef}
        value={open ? query : value}
        placeholder="Type to search…"
        onChange={e => { setQuery(e.target.value); measureAndOpen(); }}
        onFocus={() => { setQuery(''); measureAndOpen(); }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        style={{ ...fieldStyle, width: '100%', padding: '0.3rem 0.4rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
        spellCheck={false}
        autoComplete="off"
      />
      {open && keyFilterHasResults(result) && dropRect && createPortal(
        <KeyDropdownList result={result} onPick={pick} style={dropStyle} resetKey={query} />,
        document.body
      )}
    </Box>
  );
}

// ── KeySequenceEditor ─────────────────────────────────────────────────────────
// An ordered list of key-down/key-up/wait events — see KeySequenceEventSchema's
// comment in types/app-config.ts for why this exists alongside Hotkey (a
// modifier can stay held across other presses, with real timing between
// events) and why it's built manually rather than recorded.

// Walks the sequence tracking which keys are currently "held" (down'd but not
// yet up'd) — an `up` for a key that isn't currently held is meaningless on
// real hardware (there's nothing to release), so it's treated as invalid.
// Used both to flag existing broken events (e.g. after a reorder/delete
// leaves an `up` orphaned) and to gate adding a new one.
function heldKeysAfter(events: KeySequenceEvent[]): Set<string> {
  const held = new Set<string>();
  for (const e of events) {
    if (e.kind === 'down') held.add(e.key);
    else if (e.kind === 'up') held.delete(e.key);
  }
  return held;
}
function invalidKeySequenceIndices(events: KeySequenceEvent[]): Set<number> {
  const invalid = new Set<number>();
  const held = new Set<string>();
  events.forEach((e, i) => {
    if (e.kind === 'down') held.add(e.key);
    else if (e.kind === 'up') {
      if (!held.has(e.key)) invalid.add(i);
      else held.delete(e.key);
    }
  });
  return invalid;
}

// Stable per-event drag ids, cached by object reference — array-index ids
// aren't enough once a drag can live-reorder the array mid-drag (a DOWN
// dragged past its own UP carries the UP along in real time, see
// keySequenceCollisionDetection/handleEventDragOver below), since the index
// a given event sits at keeps changing while the id must not.
const eventIdMap = new WeakMap<KeySequenceEvent, string>();
let eventIdCounter = 0;
function idFor(e: KeySequenceEvent): string {
  let id = eventIdMap.get(e);
  if (!id) { id = `ev${eventIdCounter++}`; eventIdMap.set(e, id); }
  return id;
}

function SortableEventRow({ event, id, broken, willCarry, onRemove }: { event: KeySequenceEvent; id: string; broken: boolean; willCarry?: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } = useSortable({ id });
  return (
    <Box
      ref={setNodeRef}
      title={
        broken ? 'No matching "down" is currently held for this key — remove it or add a down before it' :
        willCarry ? 'Will move to sit directly after its DOWN when dropped here' : undefined
      }
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: '6px',
        border: `1px solid ${isOver ? 'var(--accent)' : willCarry ? 'var(--warning)' : broken ? 'var(--error)' : 'var(--border)'}`,
        borderStyle: willCarry ? 'dashed' : 'solid',
        backgroundColor: isOver ? 'rgba(59,130,246,0.1)' : willCarry ? 'rgba(251,191,36,0.08)' : broken ? 'rgba(248,113,113,0.08)' : 'var(--bg-base)',
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : 'auto', position: 'relative',
      }}
    >
      <Box
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        sx={{ display: 'flex', alignItems: 'center', color: 'var(--text-dim)', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', flexShrink: 0 }}
      >
        <DragIndicatorIcon sx={{ fontSize: 14 }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
        {event.kind === 'down' && (<><SouthIcon sx={{ fontSize: 13, color: 'var(--success)' }} /><span>{event.key}</span><Box component="span" sx={{ color: 'var(--text-dim)' }}>down</Box></>)}
        {event.kind === 'up'   && (<><NorthIcon sx={{ fontSize: 13, color: 'var(--error)' }} /><span>{event.key}</span><Box component="span" sx={{ color: 'var(--text-dim)' }}>up</Box>{broken && <WarningAmberIcon sx={{ fontSize: 13, color: 'var(--error)', ml: 0.3 }} />}</>)}
        {event.kind === 'wait' && (<><HourglassEmptyIcon sx={{ fontSize: 12, color: 'var(--warning)' }} /><span>{event.ms}ms</span></>)}
      </Box>
      <CloseIcon onClick={onRemove} sx={{ fontSize: 14, cursor: 'pointer', color: 'var(--text-dim)', flexShrink: 0, '&:hover': { color: 'var(--error)' } }} />
    </Box>
  );
}

// The ADD KEY / DOWN / UP buttons double as drag sources: a plain click
// (no pointer movement past the sensor's activation distance) still fires
// onClick and appends to the end, same as before — dnd-kit only takes over
// once an actual drag starts, at which point onDragEnd below inserts at
// wherever it was dropped instead of appending.
function DraggableAddButton({ id, onClick, title, sx, children }: {
  id: string; onClick: () => void; title?: string; sx: object; children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <Box ref={setNodeRef} {...attributes} {...listeners} onClick={onClick} title={title} sx={{ ...sx, opacity: isDragging ? 0.35 : 1, touchAction: 'none' }}>
      {children}
    </Box>
  );
}

// Droppable even with zero events, so dragging a button onto a brand-new
// sequence still works, not just clicking it.
function EmptyEventsDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: '0' });
  return (
    <Box ref={setNodeRef} sx={{ py: 1.5, textAlign: 'center', fontSize: '0.76rem', borderRadius: '8px', transition: 'all 0.12s', color: isOver ? 'var(--accent)' : 'var(--text-dim)', border: `1px dashed ${isOver ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: isOver ? 'rgba(59,130,246,0.06)' : 'transparent' }}>
      No events yet — add one below
    </Box>
  );
}

const ADD_SOURCE_IDS = new Set(['add-key', 'add-down', 'add-up', 'add-wait']);

function KeySequenceEditor({ events, onChange }: { events: KeySequenceEvent[]; onChange: (events: KeySequenceEvent[]) => void }) {
  const [pendingKey, setPendingKey] = useState(ALL_KEYS[0]);
  const [pendingWaitMs, setPendingWaitMs] = useState(200);
  // AUTO (default): adding a key pushes a matched down+up pair in one go —
  // always balanced, so most sequences (which are just "press these keys in
  // this order") never touch the up/down distinction at all, same as reWASD.
  // MANUAL: the original down/up buttons, for when a key genuinely needs to
  // stay held across other events (e.g. hold Shift, tap arrows, release).
  const [autoRelease, setAutoRelease] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Which row (if any) will get carried to sit right after the dragged DOWN
  // when dropped where the pointer currently is — a pure preview value, not
  // an array reorder, so it's cheap to update on every onDragOver tick
  // without touching the actual row order/DOM layout mid-drag. An earlier
  // version reordered `events` live on every onDragOver frame; that fed
  // back into dnd-kit's own rect measuring (reordering shifts row
  // positions, which retriggers collision detection, which can reorder
  // again) and produced a genuine render loop ("Maximum update depth
  // exceeded") plus visible flicker. Actual reordering — including the
  // carry — now only happens once, on drop.
  const [carryPreviewUpId, setCarryPreviewUpId] = useState<string | null>(null);

  const addEvent = (e: KeySequenceEvent) => onChange([...events, e]);
  const removeEvent = (i: number) => onChange(events.filter((_, j) => j !== i));

  function insertAt(index: number, inserted: KeySequenceEvent[]) {
    onChange([...events.slice(0, index), ...inserted, ...events.slice(index)]);
  }
  function tapEvents(key: string): KeySequenceEvent[] { return [{ kind: 'down', key }, { kind: 'up', key }]; }

  function handleDragStart({ active }: DragStartEvent) { setActiveDragId(String(active.id)); }

  // A DOWN dragged at or past its own closing UP carries that UP along to
  // sit directly after it (reWASD-style — the pair stays balanced); an UP
  // is never allowed at or before its own opening DOWN (guarded up front by
  // keySequenceCollisionDetection, but re-checked here defensively).
  // Returns null when there's nothing to do.
  function reorderKeySequence(activeId: string, overId: string): KeySequenceEvent[] | null {
    const fromIdx = events.findIndex(e => idFor(e) === activeId);
    const toIdx = events.findIndex(e => idFor(e) === overId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return null;
    const dragged = events[fromIdx];

    if (dragged.kind === 'down') {
      let closingUpIdx = -1;
      for (let i = fromIdx + 1; i < events.length; i++) {
        const e = events[i];
        if (e.kind === 'up' && e.key === dragged.key) { closingUpIdx = i; break; }
      }
      if (closingUpIdx !== -1 && toIdx >= closingUpIdx) {
        const upEvent = events[closingUpIdx];
        const remaining = events.filter((_, i) => i !== fromIdx && i !== closingUpIdx);
        const insertPos = toIdx - 1;
        return [...remaining.slice(0, insertPos), dragged, upEvent, ...remaining.slice(insertPos)];
      }
      return arrayMove(events, fromIdx, toIdx);
    }

    if (dragged.kind === 'up') {
      let opensDownIdx = -1;
      for (let i = fromIdx - 1; i >= 0; i--) {
        const e = events[i];
        if (e.kind === 'down' && e.key === dragged.key) { opensDownIdx = i; break; }
      }
      if (opensDownIdx !== -1 && toIdx <= opensDownIdx) return null;
      return arrayMove(events, fromIdx, toIdx);
    }

    return arrayMove(events, fromIdx, toIdx);
  }

  function handleEventDragOver({ active, over }: DragOverEvent) {
    const activeId = String(active.id);
    if (ADD_SOURCE_IDS.has(activeId) || !over) { setCarryPreviewUpId(null); return; }
    const fromIdx = events.findIndex(e => idFor(e) === activeId);
    const toIdx = events.findIndex(e => idFor(e) === String(over.id));
    const dragged = events[fromIdx];
    if (fromIdx === -1 || toIdx === -1 || !dragged || dragged.kind !== 'down') { setCarryPreviewUpId(null); return; }
    let closingUpIdx = -1;
    for (let i = fromIdx + 1; i < events.length; i++) {
      const e = events[i];
      if (e.kind === 'up' && e.key === dragged.key) { closingUpIdx = i; break; }
    }
    setCarryPreviewUpId(closingUpIdx !== -1 && toIdx >= closingUpIdx ? idFor(events[closingUpIdx]) : null);
  }

  function handleEventDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    setCarryPreviewUpId(null);
    const activeId = String(active.id);

    if (ADD_SOURCE_IDS.has(activeId)) {
      if (!over) return;
      const dropIndex = events.length === 0 ? 0 : events.findIndex(e => idFor(e) === String(over.id));
      if (dropIndex === -1) return;
      const inserted =
        activeId === 'add-key'  ? tapEvents(pendingKey) :
        activeId === 'add-down' ? [{ kind: 'down' as const, key: pendingKey }] :
        activeId === 'add-up'   ? [{ kind: 'up' as const, key: pendingKey }] :
        [{ kind: 'wait' as const, ms: pendingWaitMs }];
      insertAt(dropIndex, inserted);
      return;
    }

    if (!over) return;
    const result = reorderKeySequence(activeId, String(over.id));
    if (result) onChange(result);
  }

  // Constrains which rows are valid drop targets while an UP is being
  // dragged, so it simply can't be hovered at or before its own opening
  // DOWN. A DOWN has no such constraint — it's free to be dragged past its
  // own closing UP, which is what carries that UP along on drop (see
  // reorderKeySequence). ADD_SOURCE_IDS (the pill buttons) aren't
  // constrained either — there's no existing UP/DOWN pairing yet for a key
  // event that doesn't exist.
  const keySequenceCollisionDetection: CollisionDetection = (args) => {
    const activeId = String(args.active.id);
    if (ADD_SOURCE_IDS.has(activeId)) return closestCenter(args);
    const fromIdx = events.findIndex(e => idFor(e) === activeId);
    const dragged = events[fromIdx];
    if (fromIdx === -1 || !dragged || dragged.kind !== 'up') return closestCenter(args);

    let opensDownIdx = -1;
    for (let i = fromIdx - 1; i >= 0; i--) {
      const e = events[i];
      if (e.kind === 'down' && e.key === dragged.key) { opensDownIdx = i; break; }
    }
    if (opensDownIdx === -1) return closestCenter(args);

    const allowed = args.droppableContainers.filter(c => {
      const idx = events.findIndex(e => idFor(e) === String(c.id));
      return idx > opensDownIdx;
    });
    return closestCenter({ ...args, droppableContainers: allowed });
  };

  const totalWaitMs = events.reduce((sum, e) => sum + (e.kind === 'wait' ? e.ms : 0), 0);
  const invalidIndices = invalidKeySequenceIndices(events);
  const canReleasePendingKey = heldKeysAfter(events).has(pendingKey);

  const addKeyPillSx = { display: 'flex', alignItems: 'center', gap: 0.3, px: 1, py: 0.4, borderRadius: 5, border: '1px solid rgba(59,130,246,0.4)', color: 'var(--accent)', backgroundColor: 'rgba(59,130,246,0.12)', cursor: 'grab', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', '&:hover': { filter: 'brightness(1.2)' } };
  const downPillSx = { display: 'flex', alignItems: 'center', gap: 0.3, px: 1, py: 0.4, borderRadius: 5, border: '1px solid rgba(52,211,153,0.4)', color: 'var(--success)', backgroundColor: 'rgba(52,211,153,0.12)', cursor: 'grab', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', '&:hover': { filter: 'brightness(1.2)' } };
  const upPillSx = {
    display: 'flex', alignItems: 'center', gap: 0.3, px: 1, py: 0.4, borderRadius: 5,
    border: '1px solid rgba(248,113,113,0.4)', color: 'var(--error)', backgroundColor: 'rgba(248,113,113,0.12)',
    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
    cursor: canReleasePendingKey ? 'grab' : 'not-allowed',
    opacity: canReleasePendingKey ? 1 : 0.4,
    '&:hover': canReleasePendingKey ? { filter: 'brightness(1.2)' } : undefined,
  };
  const waitPillSx = { display: 'flex', alignItems: 'center', gap: 0.3, px: 1, py: 0.4, borderRadius: 5, border: '1px solid rgba(251,191,36,0.4)', color: 'var(--warning)', backgroundColor: 'rgba(251,191,36,0.12)', cursor: 'grab', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', '&:hover': { filter: 'brightness(1.2)' } };

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', flexShrink: 0 }}>
        {STEP_TYPE_HELP.keysequence}
      </Box>

      {/* Stats up top so it's visible without scrolling the list below. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', flexShrink: 0 }}>
        <HourglassEmptyIcon sx={{ fontSize: 13, color: 'var(--warning)' }} />
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-dim)' }}>TOTAL EXECUTION TIME</Box>
        <Box sx={{ ml: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{totalWaitMs}ms</Box>
      </Box>

      <DndContext sensors={sensors} collisionDetection={keySequenceCollisionDetection} onDragStart={handleDragStart} onDragOver={handleEventDragOver} onDragEnd={handleEventDragEnd}>
        {/* Only this area scrolls — everything else (toggle, add controls) stays pinned below it, however long the sequence gets. */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {events.length === 0 ? (
            <EmptyEventsDropZone />
          ) : (
            <SortableContext items={events.map(idFor)} strategy={verticalListSortingStrategy}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                {events.map((e, i) => (
                  <SortableEventRow key={idFor(e)} id={idFor(e)} event={e} broken={e.kind === 'up' && invalidIndices.has(i)} willCarry={idFor(e) === carryPreviewUpId} onRemove={() => removeEvent(i)} />
                ))}
              </Box>
            </SortableContext>
          )}
        </Box>

        <Box sx={{ flexShrink: 0 }}>
          {invalidIndices.size > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, fontSize: '0.68rem', color: 'var(--error)', mt: 1 }}>
              <WarningAmberIcon sx={{ fontSize: 13 }} />
              {invalidIndices.size} release{invalidIndices.size !== 1 ? 's' : ''} above {invalidIndices.size !== 1 ? "don't" : "doesn't"} match a held key — fix or remove before saving.
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
            {([{ v: true, l: 'AUTO' }, { v: false, l: 'MANUAL' }] as const).map(({ v, l }) => (
              <Box key={String(v)} onClick={() => setAutoRelease(v)} title={v ? 'Adding a key presses and releases it in one step' : 'Add down/up separately — lets a key stay held across other events'} sx={{ flex: 1, py: 0.4, borderRadius: 6, cursor: 'pointer', textAlign: 'center', border: `1px solid ${autoRelease === v ? 'rgba(59,130,246,0.5)' : 'var(--border)'}`, backgroundColor: autoRelease === v ? 'rgba(59,130,246,0.1)' : 'var(--bg-base)', color: autoRelease === v ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.64rem', letterSpacing: '0.05em', transition: 'all 0.12s' }}>
                {l}
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
            <KeyPicker value={pendingKey} onChange={setPendingKey} width={140} />
            {autoRelease ? (
              <DraggableAddButton id="add-key" onClick={() => insertAt(events.length, tapEvents(pendingKey))} title="Click to add at the end, or drag to insert at a specific spot" sx={addKeyPillSx}>
                <AddIcon sx={{ fontSize: 12 }} /> ADD KEY
              </DraggableAddButton>
            ) : (
              <>
                <DraggableAddButton id="add-down" onClick={() => addEvent({ kind: 'down', key: pendingKey })} title="Click to add at the end, or drag to insert at a specific spot" sx={downPillSx}>
                  <SouthIcon sx={{ fontSize: 12 }} /> DOWN
                </DraggableAddButton>
                <DraggableAddButton
                  id="add-up"
                  onClick={canReleasePendingKey ? () => addEvent({ kind: 'up', key: pendingKey }) : () => {}}
                  title={canReleasePendingKey ? 'Click to add at the end, or drag to insert at a specific spot' : `${pendingKey} isn't currently held — add a DOWN for it first`}
                  sx={upPillSx}
                >
                  <NorthIcon sx={{ fontSize: 12 }} /> UP
                </DraggableAddButton>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
            <input type="number" min={0} max={10000} value={pendingWaitMs} onChange={e => setPendingWaitMs(Math.max(0, Math.min(10000, parseInt(e.target.value) || 0)))} style={{ ...fieldStyle, width: 80, padding: '0.3rem 0.4rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }} />
            <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>ms</Box>
            <DraggableAddButton id="add-wait" onClick={() => insertAt(events.length, [{ kind: 'wait', ms: pendingWaitMs }])} title="Click to add at the end, or drag to insert at a specific spot" sx={waitPillSx}>
              <HourglassEmptyIcon sx={{ fontSize: 12 }} /> WAIT
            </DraggableAddButton>
          </Box>

          <Box sx={{ fontSize: '0.65rem', color: 'var(--text-dim)', mt: 0.75 }}>
            Any key sent &quot;down&quot; needs a matching &quot;up&quot; — an unreleased key stays physically pressed.
          </Box>
        </Box>

        <DragOverlay dropAnimation={null}>
          {activeDragId && ADD_SOURCE_IDS.has(activeDragId) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 1, py: 0.4, borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--accent)', color: 'var(--text-primary)', boxShadow: '0 6px 16px rgba(0,0,0,0.4)' }}>
              {activeDragId === 'add-key'  && <>↓↑ {pendingKey}</>}
              {activeDragId === 'add-down' && <>↓ {pendingKey}</>}
              {activeDragId === 'add-up'   && <>↑ {pendingKey}</>}
              {activeDragId === 'add-wait' && <>⧗ {pendingWaitMs}ms</>}
            </Box>
          )}
        </DragOverlay>
      </DndContext>
    </Box>
  );
}

// ── Key sequence timeline ────────────────────────────────────────────────────
// A per-key hold/release visualization — down→up pairs become a bar, and a
// `wait` event advances the shared clock by its real ms (this is a preview,
// not a precise timing chart — real playback timing only ever comes from
// `wait` events, see buildKeySequenceScript in utils/actions.ts). No time is
// ever invented between events: a released key's next press starts exactly
// where the last one ended, so back-to-back presses with no `wait` between
// them render as touching bars (each still has its own border, so they stay
// visually distinct) rather than being padded apart by a gap that would
// imply elapsed time that doesn't exist. The one liberty taken is
// MIN_SEGMENT_MS — a held segment is never narrower than that, purely so a
// genuinely-instant down→up is still visible as a sliver rather than
// vanishing; hasRealTiming below tracks whether any actual `wait` exists, so
// the caption can say so when every segment's width is that same fallback.
const MIN_SEGMENT_MS = 40;

type TimelineRow = {
  key: string;
  segments: { startMs: number; endMs: number; open: boolean }[];
  badMarkers: number[];
};

function buildKeySequenceTimeline(events: KeySequenceEvent[]): { totalMs: number; rows: TimelineRow[]; hasRealTiming: boolean } {
  let t = 0;
  let hasRealTiming = false;
  const open = new Map<string, number>();
  const rowsMap = new Map<string, TimelineRow>();
  const rowFor = (key: string) => {
    let r = rowsMap.get(key);
    if (!r) { r = { key, segments: [], badMarkers: [] }; rowsMap.set(key, r); }
    return r;
  };
  for (const e of events) {
    if (e.kind === 'wait') { if (e.ms > 0) hasRealTiming = true; t += e.ms; continue; }
    const row = rowFor(e.key);
    if (e.kind === 'down') {
      open.set(e.key, t);
    } else {
      const start = open.get(e.key);
      if (start === undefined) row.badMarkers.push(t);
      else {
        const end = Math.max(t, start + MIN_SEGMENT_MS);
        row.segments.push({ startMs: start, endMs: end, open: false });
        open.delete(e.key);
        t = end;
      }
    }
  }
  for (const [key, start] of open) {
    const end = Math.max(t, start + MIN_SEGMENT_MS);
    rowFor(key).segments.push({ startMs: start, endMs: end, open: true });
    t = Math.max(t, end);
  }
  return { totalMs: Math.max(t, 1), rows: [...rowsMap.values()], hasRealTiming };
}

function KeySequenceTimeline({ events }: { events: KeySequenceEvent[] }) {
  const { totalMs, rows, hasRealTiming } = buildKeySequenceTimeline(events);
  if (rows.length === 0) return null;
  return (
    <Box sx={{ p: 1.5, borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', mb: 1.25 }}>
      {!hasRealTiming && (
        <Box sx={{ fontSize: '0.63rem', color: 'var(--text-dim)', mb: 1 }}>
          No WAIT steps yet, so there's no real timing to show — bars here are spaced evenly just to stay readable.
        </Box>
      )}
      {rows.map(row => (
        <Box key={row.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.85, '&:last-of-type': { mb: 0 } }}>
          <Box sx={{ width: 64, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-secondary)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.key}</Box>
          <Box sx={{ flex: 1, height: 18, borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.03)', position: 'relative' }}>
            {row.segments.map((seg, i) => (
              <Box
                key={i}
                title={seg.open ? `${row.key}: held, never released` : `${row.key}: held ~${Math.round(seg.endMs - seg.startMs)}ms`}
                sx={{
                  position: 'absolute', top: 2, bottom: 2,
                  left: `${(seg.startMs / totalMs) * 100}%`,
                  width: `${Math.max((seg.endMs - seg.startMs) / totalMs * 100, 2.5)}%`,
                  borderRadius: '4px',
                  background: 'linear-gradient(90deg, rgba(52,211,153,0.55), rgba(52,211,153,0.28))',
                  border: `1px solid ${seg.open ? 'var(--warning)' : 'rgba(52,211,153,0.5)'}`,
                  borderStyle: seg.open ? 'dashed' : 'solid',
                }}
              />
            ))}
            {row.badMarkers.map((atMs, i) => (
              <Box
                key={i}
                title={`${row.key}: release with no held press`}
                sx={{ position: 'absolute', top: -3, bottom: -3, left: `${(atMs / totalMs) * 100}%`, width: '2px', backgroundColor: 'var(--error)', boxShadow: '0 0 4px var(--error)' }}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ── Icon display ──────────────────────────────────────────────────────────────

// Every action is a sequence of steps — a "Launch"/"Hotkey" action is just a
// 1-step sequence in disguise, so its icon/summary/tint is inferred from that
// single step. A 0-step or multi-step sequence gets the generic "sequence" look.
function inferActionGlyph(action: Action): { Icon: typeof RocketLaunchIcon; color: string; bg: string } {
  if (action.steps.length === 1) {
    const step = action.steps[0];
    if (step.type === 'launch') return { Icon: RocketLaunchIcon, color: 'var(--accent)', bg: 'rgba(59,130,246,0.1)' };
    if (step.type === 'hotkey') return { Icon: KeyboardIcon, color: 'var(--success)', bg: 'rgba(52,211,153,0.1)' };
    if (step.type === 'keysequence') return { Icon: KeyboardIcon, color: '#818cf8', bg: 'rgba(129,140,248,0.1)' };
  }
  return { Icon: PlaylistPlayIcon, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' };
}

function actionSummaryText(action: Action): string {
  if (action.steps.length === 1) {
    const step = action.steps[0];
    if (step.type === 'launch') return step.program;
    if (step.type === 'hotkey') return comboLabel(step.keys);
    if (step.type === 'keysequence') return `${step.events.length} key event${step.events.length !== 1 ? 's' : ''}`;
  }
  return `${action.steps.length} step${action.steps.length !== 1 ? 's' : ''}`;
}

// What tapping this card actually does — the help-mode popover body for
// ActionCard/renderListView, so browsing the Actions grid in help mode
// explains each action by its own real content instead of generic chrome.
function actionHelpBody(action: Action): string {
  let desc: string;
  if (action.steps.length === 1) {
    const step = action.steps[0];
    if (step.type === 'launch') desc = `Launches ${step.program || '(no program set)'}.`;
    else if (step.type === 'hotkey') desc = `Sends the key combo ${comboLabel(step.keys) || '(none set)'}.`;
    else if (step.type === 'keysequence') desc = `Plays a ${step.events.length}-event key sequence.`;
    else desc = `Runs 1 step (${step.type}).`;
  } else {
    desc = `Runs ${action.steps.length} step${action.steps.length !== 1 ? 's' : ''} in order.`;
  }
  const extras: string[] = [];
  if (action.requireConfirmation) extras.push('asks you to confirm first');
  if (action.favourite) extras.push('pinned to FAVOURITES');
  if (extras.length) desc += ` Also ${extras.join(' and ')}.`;
  return desc;
}

function ActionIcon({ icon, action, status, size = 32 }: {
  icon?: string; action: Action; status: CardStatus; size?: number;
}) {
  if (status === 'running') return <CircularProgress size={size * 0.5} sx={{ color: 'var(--accent)' }} />;
  if (status === 'ok')    return <CheckIcon sx={{ fontSize: size * 0.5, color: 'var(--success)' }} />;
  if (status === 'error') return <ErrorOutlineIcon sx={{ fontSize: size * 0.5, color: 'var(--error)' }} />;
  if (icon?.startsWith('data:')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icon} alt="" style={{ width: size * 0.7, height: size * 0.7, objectFit: 'contain', imageRendering: 'pixelated' }} />;
  }
  if (icon && icon.length <= 8) {
    return <Box sx={{ fontSize: size * 0.55, lineHeight: 1, userSelect: 'none' }}>{icon}</Box>;
  }
  const { Icon, color } = inferActionGlyph(action);
  return <Icon sx={{ fontSize: size * 0.45, color }} />;
}

// ── Action card ───────────────────────────────────────────────────────────────

type CardStatus = 'idle' | 'running' | 'ok' | 'error';
type SectionView = 'grid' | 'compact' | 'list';

const BORDER_COLOR = (status: CardStatus) =>
  status === 'ok' ? 'rgba(52,211,153,0.4)' : status === 'error' ? 'rgba(248,113,113,0.4)' : 'var(--border)';

// `iconOnly` is set by the caller for the section's own "icon grid" (compact)
// view — not a per-action setting. The overlay (icon + name) look is always
// used otherwise, since a per-action toggle for this was redundant with the
// section's own grid/compact/list view switcher.
function ActionCard({ action, status, onActivate, iconOnly }: { action: Action; status: CardStatus; onActivate: () => void; iconOnly?: boolean }) {
  const busy = status === 'running';

  const baseBox = {
    position: 'relative' as const,
    background: 'linear-gradient(145deg, var(--bg-raised) 0%, var(--bg-base) 100%)',
    border: `1px solid ${BORDER_COLOR(status)}`,
    borderRadius: '14px',
    cursor: busy ? 'default' : 'pointer',
    transition: 'all 0.2s ease',
    overflow: 'hidden' as const,
    aspectRatio: '1' as const,
    '&:hover': !busy ? { borderColor: 'var(--accent)', transform: 'translateY(-2px)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)' } : {},
  };

  if (iconOnly) {
    return (
      <Box onClick={!busy ? onActivate : undefined} {...helpProps(action.name, actionHelpBody(action))} sx={{ ...baseBox, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ActionIcon icon={action.icon} action={action} status={status} size={56} />
      </Box>
    );
  }

  // overlay (default)
  return (
    <Box onClick={!busy ? onActivate : undefined} {...helpProps(action.name, actionHelpBody(action))} sx={{ ...baseBox, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ActionIcon icon={action.icon} action={action} status={status} size={60} />
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: 1, py: 0.75, backgroundColor: 'rgba(10,14,24,0.82)', backdropFilter: 'blur(4px)' }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.03em', color: 'var(--text-primary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{action.name}</Box>
      </Box>
    </Box>
  );
}

// ── Action dialog ─────────────────────────────────────────────────────────────

function imgToDataUrl(source: Blob, maxPx = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(source);
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}

const emptyAction = (): Action => ({ id: '', name: '', steps: [] });

// The default Page — always exists, never stored in AppConfig.actionPages
// (same pattern as "ungrouped" needing no explicit ActionGroup entry).
// Omitted pageId on an Action or ActionGroup both mean this.
const HOME_PAGE_ID = 'home';

function ActionDialog({ action, actions, groups, pages, activePageId, isLocalhost, onSave, onClose }: {
  action: Action; actions: Action[]; groups: ActionGroup[]; pages: ActionPage[]; activePageId: string; isLocalhost: boolean;
  onSave: (a: Action, newGroupName?: string, newGroupPageId?: string, newPageName?: string) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<Action>(() => ({ ...action, steps: [...action.steps] }));
  const [newGroupName, setNewGroupName] = useState('');
  const [newPageName, setNewPageName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [showIconExeBrowser, setShowIconExeBrowser] = useState(false);
  const [showIconAppsBrowser, setShowIconAppsBrowser] = useState(false);
  const [showIconProcessBrowser, setShowIconProcessBrowser] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepsCtx = useStepEditor(form.steps, steps => setForm(f => ({ ...f, steps })), actions, form.id);

  const initialFormJson = useRef(JSON.stringify({ ...action, steps: [...action.steps] }));

  function isDirty() {
    return JSON.stringify(form) !== initialFormJson.current || newGroupName.trim() !== '' || newPageName.trim() !== '';
  }

  function requestClose() {
    if (isDirty()) { setConfirmDiscard(true); } else { onClose(); }
  }

  const extractIcon = useCallback(async (program: string) => {
    if (!program.trim()) return;
    setExtracting(true);
    try {
      const data = await apiFetch<{ icon?: string }>('/api/actions/extract-icon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program }),
      });
      if (data.icon) setForm(f => ({ ...f, icon: data.icon }));
    } catch {
      // Best-effort — icon extraction failing shouldn't block the rest of the form.
    } finally {
      setExtracting(false);
    }
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await imgToDataUrl(file);
      setForm(f => ({ ...f, icon: dataUrl }));
    } catch {}
    e.target.value = '';
  }

  async function handleIconPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const imageItem = Array.from(e.clipboardData.items).find(item => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const blob = imageItem.getAsFile();
    if (!blob) return;
    try {
      const dataUrl = await imgToDataUrl(blob);
      setForm(f => ({ ...f, icon: dataUrl }));
    } catch {}
  }

  const isNewGroup = form.groupId === '__new__';
  const isNewPage = form.pageId === '__new__';
  const functionalValid = isLocalhost ? form.steps.length > 0 : true;
  const keySequencesValid = form.steps.every(s => s.type !== 'keysequence' || invalidKeySequenceIndices(s.events).size === 0);
  const valid = form.name.trim() && functionalValid && keySequencesValid && (!isNewGroup || newGroupName.trim()) && (!isNewPage || newPageName.trim());

  function handleSave() {
    let groupId = form.groupId;
    let extraGroupName: string | undefined;
    let extraGroupPageId: string | undefined;
    if (isNewGroup && newGroupName.trim()) {
      groupId = toKebabId(newGroupName);
      extraGroupName = newGroupName.trim();
      extraGroupPageId = activePageId === HOME_PAGE_ID ? undefined : activePageId;
    }
    // pageId is only meaningful when ungrouped — a grouped action always
    // follows its group's page — so clear it once a group is chosen.
    let pageId = groupId ? undefined : form.pageId;
    let extraPageName: string | undefined;
    if (!groupId && isNewPage && newPageName.trim()) {
      pageId = toKebabId(newPageName);
      extraPageName = newPageName.trim();
    }
    onSave({ ...form, id: form.id || toKebabId(form.name), groupId, pageId }, extraGroupName, extraGroupPageId, extraPageName);
  }

  const previewWidth = 96;
  const stepFieldStyle = { ...fieldStyle, fontSize: '0.78rem', padding: '0.35rem 0.5rem' } as React.CSSProperties;

  const dialog = (
    <ModalShell onClose={requestClose} maxWidth={1280}>
        <DialogHeader
          title={action.id ? 'EDIT ACTION' : 'ADD ACTION'}
          onClose={requestClose}
          endAdornment={
            <HelpOutlineIcon
              onClick={() => setShowHelp(true)}
              titleAccess="How Actions work"
              sx={{ fontSize: 19, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--accent)' } }}
            />
          }
        />

        {/* Whole-dialog three-way split: left is everything about the action
            EXCEPT the sequence itself (name, icon, group, page, toggles,
            save/cancel); middle is the sequence — the compact, reorderable
            step list; right is exclusively the selected step's own controls,
            filling the dialog's full height. */}
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2, height: 'min(640px, calc(100vh - 200px))' }}>
          {/* Left: everything about the action except the sequence. */}
          <Box sx={{ width: 340, flexShrink: 0, overflowY: 'auto', pr: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ width: previewWidth, pointerEvents: 'none' }}>
                <ActionCard action={form} status="idle" onActivate={() => {}} />
              </Box>
            </Box>

            <Box><FormLabel>NAME</FormLabel><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name your action…" style={fieldStyle} onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }} onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }} spellCheck={false} /></Box>

            {!isLocalhost && (
              <Box sx={{ px: 1.5, py: 1, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', fontSize: '0.75rem', color: 'var(--warning)', lineHeight: 1.5 }}>
                Connecting from a remote device — only display settings can be changed here. Open from the host PC to edit functional settings.
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
              <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-dim)' }}>DETAILS</Box>
              <Box sx={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
            </Box>

            <Box>
              <FormLabel hint="Emoji, image file, exe icon, or clipboard paste">ICON</FormLabel>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.75 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', flexShrink: 0, backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ActionIcon icon={form.icon} action={form} status="idle" size={40} />
                </Box>
                <input
                  value={form.icon?.startsWith('data:') ? '' : (form.icon ?? '')}
                  onChange={e => setForm(f => ({ ...f, icon: e.target.value || undefined }))}
                  onPaste={handleIconPaste}
                  placeholder={form.icon?.startsWith('data:') ? '(image)' : 'emoji, or paste image (Ctrl+V)'}
                  style={{ ...fieldStyle, flex: 1 }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
                {form.icon && (
                  <Box onClick={() => setForm(f => ({ ...f, icon: undefined }))} sx={{ px: 1, py: 0.6, borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.7rem', flexShrink: 0, '&:hover': { color: 'var(--error)', borderColor: 'var(--error)' } }}>
                    ✕
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                <Box
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ px: 1.25, py: 0.6, borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' }, transition: 'all 0.15s' }}
                >
                  UPLOAD
                </Box>
                <Box
                  onClick={() => {
                    if (!extracting) {
                      if (form.steps.length === 1 && form.steps[0].type === 'launch') extractIcon(form.steps[0].program);
                      else setShowIconExeBrowser(true);
                    }
                  }}
                  sx={{ px: 1.25, py: 0.6, borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: extracting ? 'default' : 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': !extracting ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}, transition: 'all 0.15s' }}
                >
                  {extracting ? <CircularProgress size={11} sx={{ color: 'inherit' }} /> : null}
                  FROM EXE
                </Box>
                <Box
                  onClick={() => { if (!extracting) setShowIconAppsBrowser(true); }}
                  sx={{ px: 1.25, py: 0.6, borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: extracting ? 'default' : 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': !extracting ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}, transition: 'all 0.15s' }}
                >
                  FROM APP
                </Box>
                <Box
                  onClick={() => { if (!extracting) setShowIconProcessBrowser(true); }}
                  title="Pick a currently-running app — works for packaged/UWP apps that FROM APP can't extract from"
                  sx={{ px: 1.25, py: 0.6, borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: extracting ? 'default' : 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': !extracting ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}, transition: 'all 0.15s' }}
                >
                  FROM PROCESS
                </Box>
              </Box>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <FormLabel>GROUP</FormLabel>
                <select value={form.groupId ?? ''} onChange={e => { setForm(f => ({ ...f, groupId: e.target.value || undefined })); setNewGroupName(''); }} style={fieldStyle}>
                  <option value="">— None —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  <option value="__new__">+ New group…</option>
                </select>
                {isNewGroup && (
                  <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group name" style={{ ...fieldStyle, marginTop: 6, fontFamily: 'var(--font-body)' }} onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }} onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }} spellCheck={false} autoFocus />
                )}
              </Box>

              {/* Page — only relevant when ungrouped; a grouped action always
                  follows its group's page (set when the group itself was created). */}
              {!form.groupId && (
                <Box sx={{ flex: 1 }}>
                  <FormLabel>PAGE</FormLabel>
                  <select value={form.pageId ?? HOME_PAGE_ID} onChange={e => { setForm(f => ({ ...f, pageId: e.target.value === HOME_PAGE_ID ? undefined : e.target.value })); setNewPageName(''); }} style={fieldStyle}>
                    <option value={HOME_PAGE_ID}>Home</option>
                    {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    <option value="__new__">+ New page…</option>
                  </select>
                  {isNewPage && (
                    <input value={newPageName} onChange={e => setNewPageName(e.target.value)} placeholder="Page name" style={{ ...fieldStyle, marginTop: 6, fontFamily: 'var(--font-body)' }} onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }} onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }} spellCheck={false} autoFocus />
                  )}
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
                onClick={() => setForm(f => ({ ...f, favourite: !f.favourite }))}
                {...helpProps('Favourite', "Pins this Action to a FAVOURITES section at the top of its Page, so frequently-used Actions don't get buried in a long list.")}
              >
                <Box sx={{ color: form.favourite ? 'var(--warning)' : 'var(--text-dim)', display: 'flex', '& .MuiSvgIcon-root': { fontSize: 20 } }}>
                  {form.favourite ? <StarIcon /> : <StarBorderIcon />}
                </Box>
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em', color: form.favourite ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {form.favourite ? 'FAVOURITED' : 'ADD TO FAVOURITES'}
                </Box>
              </Box>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
                onClick={() => setForm(f => ({ ...f, requireConfirmation: !f.requireConfirmation }))}
                {...helpProps('Require Confirmation', "Shows an 'are you sure?' prompt before this Action runs — for anything disruptive (closing windows, switching displays mid-game) you don't want triggered by an accidental tap.")}
              >
                <ToggleSwitch checked={form.requireConfirmation ?? false} onChange={() => {}} />
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em', color: form.requireConfirmation ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  REQUIRE CONFIRMATION
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Middle: the sequence itself — compact, reorderable step list. */}
          {isLocalhost && (
            <Box sx={{ width: 340, flexShrink: 0, overflowY: 'auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', px: 2 }}>
              <FormLabel hint="Steps execute in order. Use WAIT to add delays between them. Click a step to edit it on the right.">STEPS</FormLabel>
              <StepListColumn stepsCtx={stepsCtx} />
            </Box>
          )}

          {/* Right: exclusively the selected step's own controls, full height.
              flex column so a step type that needs it (Key Sequence) can pin
              its own controls to the bottom and scroll only its event list —
              see the flex:1/minHeight:0 chain into StepDetailEditor below.
              Other step types don't opt into that and just render at their
              natural height within the column, same as before. */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', pl: isLocalhost ? 0.5 : 2.5, borderLeft: isLocalhost ? undefined : '1px solid var(--border)' }}>
            {!isLocalhost ? (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', px: 3 }}>
                Open from the host PC to edit steps.
              </Box>
            ) : stepsCtx.selected !== null ? (() => {
              const step = stepsCtx.steps[stepsCtx.selected as number];
              const badge = STEP_BADGE[step.type];
              return (
                <>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.85, py: 0.25, borderRadius: '5px', backgroundColor: badge.bg, color: badge.color, fontFamily: 'var(--font-display)', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', mb: 1.25, flexShrink: 0 }}>
                    <badge.Icon sx={{ fontSize: 13 }} />
                    {badge.label}
                  </Box>
                  <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <StepDetailEditor
                      step={step}
                      eligible={stepsCtx.eligible}
                      displayProfiles={stepsCtx.displayProfiles}
                      fanProfiles={stepsCtx.fanProfiles}
                      configuredAudioDevices={stepsCtx.configuredAudioDevices}
                      iSel={stepFieldStyle}
                      onUpdate={s => stepsCtx.update(stepsCtx.selected as number, s)}
                      onBrowseClick={() => stepsCtx.setBrowserForStep(stepsCtx.selected)}
                      onAppsClick={() => stepsCtx.setAppsForStep(stepsCtx.selected)}
                    />
                  </Box>
                </>
              );
            })() : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', px: 3 }}>
                Add a step on the left to configure it here.
              </Box>
            )}
          </Box>
        </Box>

        <DialogButtons onCancel={requestClose} onConfirm={handleSave} confirmDisabled={!valid} />
    </ModalShell>
  );

  return (
    <>
      {dialog}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
      {showIconExeBrowser && (
        <FileBrowserDialog
          onSelect={p => { setShowIconExeBrowser(false); extractIcon(p); }}
          onClose={() => setShowIconExeBrowser(false)}
        />
      )}
      {showIconAppsBrowser && (
        <InstalledAppsDialog
          onSelect={(program, _args, type) => {
            setShowIconAppsBrowser(false);
            if (type === 'exe') extractIcon(program);
            else showToast("Can't extract an icon for that app this way — if it's running, try FROM PROCESS instead.", 'error');
          }}
          onClose={() => setShowIconAppsBrowser(false)}
        />
      )}
      {showIconProcessBrowser && (
        <RunningProcessDialog
          onSelect={p => { setShowIconProcessBrowser(false); extractIcon(p); }}
          onClose={() => setShowIconProcessBrowser(false)}
        />
      )}
      {stepsCtx.browserForStep !== null && stepsCtx.steps[stepsCtx.browserForStep]?.type === 'launch' && (() => {
        const i = stepsCtx.browserForStep as number;
        const s = stepsCtx.steps[i] as Extract<SequenceStep, { type: 'launch' }>;
        return (
          <FileBrowserDialog
            initial={s.program}
            onSelect={p => { stepsCtx.update(i, { ...s, program: p }); stepsCtx.setBrowserForStep(null); }}
            onClose={() => stepsCtx.setBrowserForStep(null)}
          />
        );
      })()}
      {stepsCtx.appsForStep !== null && stepsCtx.steps[stepsCtx.appsForStep]?.type === 'launch' && (() => {
        const i = stepsCtx.appsForStep as number;
        const s = stepsCtx.steps[i] as Extract<SequenceStep, { type: 'launch' }>;
        return (
          <InstalledAppsDialog
            onSelect={(program, args, _type) => { stepsCtx.update(i, { ...s, program, args }); stepsCtx.setAppsForStep(null); }}
            onClose={() => stepsCtx.setAppsForStep(null)}
          />
        );
      })()}
      {confirmDiscard && createPortal(
        <Box sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1360, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }} onClick={() => setConfirmDiscard(false)}>
          <Box sx={{ width: '100%', maxWidth: 300, backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }} onClick={e => e.stopPropagation()}>
            <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>DISCARD CHANGES?</Box>
            <Box sx={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Your unsaved changes will be lost.</Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Box onClick={() => setConfirmDiscard(false)} sx={{ px: 2, py: 0.75, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.05em', '&:hover': { backgroundColor: 'var(--border)' } }}>KEEP EDITING</Box>
              <Box onClick={onClose} sx={{ px: 2, py: 0.75, borderRadius: 7, backgroundColor: 'var(--error)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.05em' }}>DISCARD</Box>
            </Box>
          </Box>
        </Box>,
        document.body
      )}
    </>
  );
}

// ── View toggle ───────────────────────────────────────────────────────────────

function ViewToggle({ current, onChange }: { current: SectionView; onChange: (v: SectionView) => void }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.25, ml: 'auto', flexShrink: 0 }}>
      {([
        { v: 'grid'    as const, Icon: ViewModuleIcon, title: 'Card grid' },
        { v: 'compact' as const, Icon: AppsIcon,       title: 'Icon grid' },
        { v: 'list'    as const, Icon: ViewListIcon,   title: 'List'      },
      ]).map(({ v, Icon, title }) => (
        <Box key={v} onClick={() => onChange(v)} title={title} sx={{
          p: 0.4, borderRadius: '4px', display: 'flex', alignItems: 'center', cursor: 'pointer',
          color: current === v ? 'var(--accent)' : 'var(--border)',
          '&:hover': { color: current === v ? 'var(--accent)' : 'var(--text-dim)' },
        }}>
          <Icon sx={{ fontSize: 14 }} />
        </Box>
      ))}
    </Box>
  );
}

// ── Section rendering helpers ─────────────────────────────────────────────────

const SECTION_HEADER_SX = {
  display: 'flex', alignItems: 'center', gap: 1, mb: 1.25,
  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem',
  letterSpacing: '0.1em', color: 'var(--text-dim)',
};

const EDIT_ROW_SX = {
  display: 'flex', alignItems: 'center', gap: 1.25,
  px: 1.25, py: 1, borderRadius: '10px',
  border: '1px solid var(--border)', backgroundColor: 'var(--bg-raised)',
};


// ── Sequence step editor ──────────────────────────────────────────────────────

const STEP_BADGE: Record<SequenceStep['type'], { bg: string; color: string; label: string; Icon: typeof RocketLaunchIcon }> = {
  macro:   { bg: 'rgba(59,130,246,0.12)',  color: 'var(--accent)',   label: 'ACTION',     Icon: PlaylistPlayIcon },
  delay:   { bg: 'rgba(251,191,36,0.12)',  color: 'var(--warning)',  label: 'WAIT',       Icon: HourglassEmptyIcon },
  hotkey:  { bg: 'rgba(52,211,153,0.12)',  color: 'var(--success)',  label: 'KEY',        Icon: KeyboardIcon },
  keysequence: { bg: 'rgba(129,140,248,0.12)', color: '#818cf8',     label: 'KEY SEQ',    Icon: KeyboardIcon },
  launch:  { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa',         label: 'RUN',        Icon: RocketLaunchIcon },
  text:    { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c',         label: 'ENTER TEXT', Icon: TextFieldsIcon },
  display: { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa',         label: 'DISPLAY',    Icon: MonitorIcon },
  audio:   { bg: 'rgba(244,114,182,0.12)', color: '#f472b6',         label: 'AUDIO',      Icon: VolumeUpIcon },
  fan:     { bg: 'rgba(45,212,191,0.12)',  color: '#2dd4bf',         label: 'FAN',        Icon: AirIcon },
};

// One-line explanation per step type — the single source of truth for the
// ADD-STEP pill tooltips (AddStepPills below), the HelpDialog's step-type
// list, and the inline hints shown above the Hotkey/Key Sequence editors.
// IMPORTANT: if you change what a step type does (new fields, changed
// behavior, fault-tolerance, etc.) update its entry here too — this is the
// only place the explanation lives, so it drifts silently otherwise.
const STEP_TYPE_HELP: Record<SequenceStep['type'], string> = {
  macro: 'Run another Action by name — build one Action out of others.',
  delay: 'Pause for a fixed number of milliseconds before the next step runs.',
  hotkey: 'All keys below are pressed together as one combo — add more to build e.g. Alt + R.',
  keysequence: "An ordered list of key-down / key-up / wait events — lets a modifier stay held across other presses, unlike Hotkey's all-at-once combo.",
  launch: 'Start a program, optionally focusing its window once it appears.',
  text: 'Type text into whatever window currently has focus.',
  display: 'Switch to a saved monitor layout.',
  audio: 'Switch the default audio output device, optionally setting its volume.',
  fan: 'Apply a saved FanControl profile.',
};

// The Add/Edit Action dialog's "?" help — explains the 3-pane layout and
// every step type. IMPORTANT: this is the one place that layout is
// documented for end users, so update it in the same change as any layout
// or step-type edit to ActionDialog/StepDetailEditor — it has no other way
// to catch drift, since nothing here is generated from the component tree.
function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} maxWidth={560}>
      <DialogHeader title="HOW ACTIONS WORK" onClose={onClose} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <Box>
          An <b style={{ color: 'var(--text-primary)' }}>Action</b> is a named sequence of steps that runs in one tap — a single-step Action is just a 1-step sequence.
        </Box>

        <Box>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)', mb: 0.75 }}>THE THREE PANES</Box>
          <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <li><b style={{ color: 'var(--text-primary)' }}>Left</b> — everything about the Action itself: name, icon, group, page, favourite, confirmation, and Save/Cancel.</li>
            <li><b style={{ color: 'var(--text-primary)' }}>Middle</b> — the sequence: your ordered list of steps. Drag to reorder, click a step to edit it on the right, or add a new one from the row of type buttons below the list.</li>
            <li><b style={{ color: 'var(--text-primary)' }}>Right</b> — exclusively the currently-selected step's own fields.</li>
          </Box>
        </Box>

        <Box>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)', mb: 0.75 }}>STEP TYPES</Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {(Object.keys(STEP_BADGE) as SequenceStep['type'][]).map(type => {
              const badge = STEP_BADGE[type];
              return (
                <Box key={type} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.75, py: 0.2, borderRadius: '4px', backgroundColor: badge.bg, color: badge.color, fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', flexShrink: 0, mt: 0.15, whiteSpace: 'nowrap' }}>
                    <badge.Icon sx={{ fontSize: 12 }} />
                    {badge.label}
                  </Box>
                  <Box>{STEP_TYPE_HELP[type]}</Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box sx={{ px: 1.5, py: 1, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', color: 'var(--warning)', fontSize: '0.76rem' }}>
          DISPLAY, AUDIO, and FAN steps are fault-tolerant — if one fails (e.g. a display profile went stale), it's logged as a warning and the rest of the sequence still runs. Every other step type aborts the sequence on failure.
        </Box>
      </Box>
    </ModalShell>
  );
}

// One-line summary of a step's configured value, for the compact left-pane
// list row — mirrors actionSummaryText's per-type logic but covers every
// step type (that one only special-cases the 3 types a single-step Action
// can be inferred from).
function stepSummaryText(step: SequenceStep, ctx: {
  eligible: Action[]; displayProfiles: { id: string; label: string }[]; configuredAudioDevices: ConfiguredAudioDevice[];
}): string {
  switch (step.type) {
    case 'macro': return ctx.eligible.find(a => a.id === step.macroId)?.name ?? '— not selected —';
    case 'delay': return step.ms >= 1000 ? `${step.ms / 1000}s` : `${step.ms}ms`;
    case 'hotkey': return step.keys.length ? comboLabel(step.keys) : '— no keys —';
    case 'keysequence': return step.events.length ? `${step.events.length} event${step.events.length !== 1 ? 's' : ''}` : '— empty —';
    case 'launch': return step.program || '— no program —';
    case 'text': return step.text || '— empty —';
    case 'display': return ctx.displayProfiles.find(p => p.id === step.displayProfileId)?.label ?? '— not selected —';
    case 'audio': return ctx.configuredAudioDevices.find(d => d.id === step.audioDeviceId)?.name ?? '— not selected —';
    case 'fan': return step.fanProfile || '— not selected —';
  }
}

// Compact left-pane list row — badge + one-line summary + drag handle +
// delete. Click anywhere else on the row to select it for the right-pane
// detail editor (StepDetailEditor below).
function CompactStepRow({ step, index, selected, summary, onSelect, onRemove }: {
  step: SequenceStep;
  index: number;
  selected: boolean;
  summary: string;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: String(index) });
  const badge = STEP_BADGE[step.type];
  return (
    <Box
      ref={setNodeRef}
      onClick={onSelect}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.75, borderRadius: '9px', cursor: 'pointer',
        border: `1px solid ${selected ? 'rgba(59,130,246,0.45)' : 'var(--border)'}`,
        background: selected ? 'linear-gradient(145deg, rgba(59,130,246,0.14), rgba(59,130,246,0.03))' : 'var(--bg-elevated)',
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : 'auto', position: 'relative', mb: 0.5,
      }}
    >
      <Box
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        sx={{ display: 'flex', alignItems: 'center', color: 'var(--text-dim)', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', flexShrink: 0 }}
      >
        <DragIndicatorIcon sx={{ fontSize: 15 }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.75, py: 0.2, borderRadius: '4px', backgroundColor: badge.bg, color: badge.color, fontFamily: 'var(--font-display)', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em' }}>
          <badge.Icon sx={{ fontSize: 11 }} />
          {badge.label}
        </Box>
        <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', mt: 0.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {summary}
        </Box>
      </Box>
      <DeleteOutlineIcon onClick={e => { e.stopPropagation(); onRemove(); }} sx={{ fontSize: 15, color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0, '&:hover': { color: 'var(--error)' } }} />
    </Box>
  );
}

// The full editor for a single step's fields — lives in the right pane of
// the split view, showing whichever step is currently selected in the
// left-pane CompactStepRow list.
function StepDetailEditor({ step, eligible, displayProfiles, fanProfiles, configuredAudioDevices, iSel, onUpdate, onBrowseClick, onAppsClick }: {
  step: SequenceStep;
  eligible: Action[];
  displayProfiles: { id: string; label: string }[];
  fanProfiles: string[];
  configuredAudioDevices: ConfiguredAudioDevice[];
  iSel: React.CSSProperties;
  onUpdate: (s: SequenceStep) => void;
  onBrowseClick: () => void;
  onAppsClick: () => void;
}) {
  return (
      <Box sx={{ minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {step.type === 'macro' && (
          <select value={step.macroId} onChange={e => onUpdate({ ...step, macroId: e.target.value })} style={iSel}>
            <option value="">— Select action —</option>
            {eligible.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        {step.type === 'delay' && (
          <Box>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
              {[250, 500, 1000, 2000].map(ms => (
                <Box key={ms} onClick={() => onUpdate({ ...step, ms })} sx={{ px: 0.85, py: 0.2, borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', border: `1px solid ${step.ms === ms ? 'rgba(59,130,246,0.5)' : 'var(--border)'}`, backgroundColor: step.ms === ms ? 'rgba(59,130,246,0.1)' : 'var(--bg-base)', color: step.ms === ms ? 'var(--accent)' : 'var(--text-dim)' }}>
                  {ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
                </Box>
              ))}
            </Box>
            <input type="number" min="0" max="60000" value={step.ms}
              onChange={e => onUpdate({ ...step, ms: Math.max(0, parseInt(e.target.value) || 0) })}
              style={{ ...iSel, width: '90px', fontFamily: 'var(--font-mono)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </Box>
        )}
        {step.type === 'hotkey' && (
          <Box>
            <Box sx={{ fontSize: '0.68rem', color: 'var(--text-dim)', mb: 0.5 }}>
              {STEP_TYPE_HELP.hotkey}
            </Box>
            <KeyComboInput keys={step.keys} onChange={keys => onUpdate({ ...step, keys })} />
          </Box>
        )}
        {step.type === 'keysequence' && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <KeySequenceTimeline events={step.events} />
            <KeySequenceEditor events={step.events} onChange={events => onUpdate({ ...step, events })} />
          </Box>
        )}
        {step.type === 'launch' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {/* Program + browse */}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <input value={step.program} placeholder="C:\path\to\program.exe"
                onChange={e => onUpdate({ ...step, program: e.target.value })}
                style={{ ...iSel, flex: 1, fontFamily: 'var(--font-mono)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                spellCheck={false}
              />
              <Box onClick={onAppsClick} title="Installed apps…" sx={{ height: 32, px: 0.75, borderRadius: '6px', flexShrink: 0, border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.05em', '&:hover': { borderColor: 'var(--accent)', backgroundColor: 'rgba(59,130,246,0.08)' }, transition: 'all 0.15s' }}>
                APPS
              </Box>
              <Box onClick={onBrowseClick} title="Browse files…" sx={{ width: 32, height: 32, borderRadius: '6px', flexShrink: 0, border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fbbf24', '&:hover': { borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.08)' }, transition: 'all 0.15s' }}>
                <FolderOpenIcon sx={{ fontSize: 15 }} />
              </Box>
            </Box>
            {/* Args */}
            <input value={(step.args ?? []).join(' ')} placeholder="arguments (optional)"
              onChange={e => onUpdate({ ...step, args: e.target.value ? e.target.value.split(' ') : undefined })}
              style={{ ...iSel, fontFamily: 'var(--font-mono)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              spellCheck={false}
            />
            {/* Auto-focus toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} onClick={() => onUpdate({ ...step, autoFocus: !step.autoFocus })}>
              <ToggleSwitch checked={step.autoFocus ?? false} onChange={() => {}} size="sm" />
              <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.05em', color: step.autoFocus ? 'var(--text-primary)' : 'var(--text-secondary)' }}>AUTO-FOCUS</Box>
            </Box>
            {/* Focus mode */}
            {step.autoFocus && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {([{ v: 'scan' as const, l: 'Scan' }, { v: 'delay' as const, l: 'After Delay' }]).map(({ v, l }) => {
                    const active = (step.focusMode ?? 'scan') === v;
                    return (
                      <Box key={v} onClick={() => onUpdate({ ...step, focusMode: v })} sx={{ flex: 1, py: 0.5, borderRadius: 6, cursor: 'pointer', textAlign: 'center', border: `1px solid ${active ? 'rgba(59,130,246,0.5)' : 'var(--border)'}`, backgroundColor: active ? 'rgba(59,130,246,0.1)' : 'var(--bg-base)', color: active ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.04em', transition: 'all 0.12s' }}>
                        {l}
                      </Box>
                    );
                  })}
                </Box>
                {(step.focusMode ?? 'scan') === 'delay' && (
                  <input type="number" min="100" max="10000" step="100"
                    value={step.focusDelay ?? 600}
                    onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) onUpdate({ ...step, focusDelay: n }); }}
                    style={{ ...iSel, width: '90px', fontFamily: 'var(--font-mono)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; onUpdate({ ...step, focusDelay: Math.max(100, Math.min(10000, step.focusDelay ?? 600)) }); }}
                  />
                )}
              </Box>
            )}
          </Box>
        )}
        {step.type === 'text' && (
          <input value={step.text} placeholder="Text to type"
            onChange={e => onUpdate({ ...step, text: e.target.value })}
            style={iSel}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
        )}
        {step.type === 'display' && (
          <select value={step.displayProfileId} onChange={e => onUpdate({ ...step, displayProfileId: e.target.value })} style={iSel}>
            <option value="">— Select display profile —</option>
            {displayProfiles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        )}
        {step.type === 'audio' && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <select value={step.audioDeviceId} onChange={e => onUpdate({ ...step, audioDeviceId: e.target.value })} style={{ ...iSel, flex: 1, minWidth: 140 }}>
              <option value="">— Select audio device —</option>
              {configuredAudioDevices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input type="number" min={0} max={100} placeholder="Vol % (optional)"
              value={step.audioVolume ?? ''}
              onChange={e => onUpdate({ ...step, audioVolume: e.target.value ? Number(e.target.value) : undefined })}
              style={{ ...iSel, width: '110px' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </Box>
        )}
        {step.type === 'fan' && (
          fanProfiles.length > 0
            ? <select value={step.fanProfile} onChange={e => onUpdate({ ...step, fanProfile: e.target.value })} style={iSel}>
                <option value="">— Select fan profile —</option>
                {fanProfiles.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            : <input value={step.fanProfile} placeholder="Fan profile name"
                onChange={e => onUpdate({ ...step, fanProfile: e.target.value })}
                style={iSel}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
        )}
      </Box>
  );
}

// Steps state lifted out of any single sub-panel: ActionDialog itself is the
// whole-modal split now (left = everything about the action, right =
// exclusively the selected step's own editor, full dialog height), so both
// halves need this state as siblings rather than one owning the other.
function useStepEditor(steps: SequenceStep[], onChange: (s: SequenceStep[]) => void, actions: Action[], selfId: string) {
  const [browserForStep, setBrowserForStep] = useState<number | null>(null);
  const [appsForStep, setAppsForStep] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const eligible = actions.filter(a => a.id !== selfId);

  const { data: displayProfiles = [] } = useDisplayProfiles();
  const { data: fanProfilesRaw } = useFanProfiles();
  const { data: config } = useAppConfig();
  const fanProfiles = (Array.isArray(fanProfilesRaw) ? [] : (fanProfilesRaw?.availableProfiles ?? [])).map((f: string) => f.replace(/\.json$/i, ''));
  const configuredAudioDevices = config?.configuredAudioDevices ?? [];

  // Derived rather than effect-synced: falls back to the first step whenever
  // the stored selection is unset or points past the end of the (possibly
  // just-shrunk) list, without needing a useEffect to keep it in bounds.
  const selected = selectedIndex !== null && selectedIndex < steps.length ? selectedIndex : (steps.length > 0 ? 0 : null);

  function update(i: number, s: SequenceStep) { onChange(steps.map((x, j) => j === i ? s : x)); }
  function remove(i: number) {
    onChange(steps.filter((_, j) => j !== i));
    setSelectedIndex(prev => {
      if (prev === null) return null;
      if (i < prev) return prev - 1;
      if (i === prev) return null;
      return prev;
    });
  }
  function handleStepDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = Number(active.id), to = Number(over.id);
    onChange(arrayMove(steps, from, to));
    setSelectedIndex(prev => prev === null ? null : prev === from ? to : prev);
  }
  function addStep(type: SequenceStep['type']) {
    const s: SequenceStep =
      type === 'macro'   ? { type, macroId: eligible[0]?.id ?? '' } :
      type === 'delay'   ? { type, ms: 500 } :
      type === 'hotkey'  ? { type, keys: [] } :
      type === 'keysequence' ? { type, events: [] } :
      type === 'launch'  ? { type, program: '' } :
      type === 'text'    ? { type, text: '' } :
      type === 'display' ? { type, displayProfileId: '' } :
      type === 'audio'   ? { type, audioDeviceId: '' } :
      { type, fanProfile: '' };
    onChange([...steps, s]);
    setSelectedIndex(steps.length);
  }

  return {
    steps, selected, setSelectedIndex, eligible, displayProfiles, fanProfiles, configuredAudioDevices,
    update, remove, addStep, handleStepDragEnd,
    browserForStep, setBrowserForStep, appsForStep, setAppsForStep,
  };
}

function AddStepPills({ onAdd }: { onAdd: (type: SequenceStep['type']) => void }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
      {(['macro', 'delay', 'hotkey', 'keysequence', 'launch', 'text', 'display', 'audio', 'fan'] as const).map(type => {
        const badge = STEP_BADGE[type];
        return (
          <Box key={type} onClick={() => onAdd(type)} title={STEP_TYPE_HELP[type]} {...helpProps(badge.label, STEP_TYPE_HELP[type])} sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 1, py: 0.4, borderRadius: 5, border: `1px solid ${badge.bg.replace('0.12', '0.4')}`, color: badge.color, backgroundColor: badge.bg, cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.66rem', letterSpacing: '0.04em', '&:hover': { borderColor: badge.color, filter: 'brightness(1.25)' }, transition: 'all 0.12s' }}>
            <badge.Icon sx={{ fontSize: 12 }} />
            {type === 'delay' ? 'WAIT' : type === 'text' ? 'ENTER TEXT' : type === 'macro' ? 'ACTION' : type === 'hotkey' ? 'HOTKEY' : type === 'keysequence' ? 'KEY SEQ' : type === 'launch' ? 'LAUNCH' : type.toUpperCase()}
          </Box>
        );
      })}
    </Box>
  );
}

// Left-hand compact step list — badge + one-line summary per step, drag to
// reorder, click to select for the right-hand StepDetailEditor (rendered by
// the caller — see ActionDialog — since it now lives in the OTHER half of
// the dialog's own top-level split, not nested alongside this list).
function StepListColumn({ stepsCtx }: { stepsCtx: ReturnType<typeof useStepEditor> }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const { steps, selected, setSelectedIndex, eligible, displayProfiles, configuredAudioDevices, remove, addStep, handleStepDragEnd } = stepsCtx;
  const summaryCtx = { eligible, displayProfiles, configuredAudioDevices };

  if (steps.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ py: 2.5, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.78rem', border: '1px dashed var(--border)', borderRadius: '8px' }}>
          No steps yet — add one below
        </Box>
        <AddStepPills onAdd={addStep} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box>
        <DndContext sensors={sensors} onDragEnd={handleStepDragEnd}>
          <SortableContext items={steps.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
            {steps.map((step, i) => (
              <CompactStepRow
                key={i}
                step={step}
                index={i}
                selected={i === selected}
                summary={stepSummaryText(step, summaryCtx)}
                onSelect={() => setSelectedIndex(i)}
                onRemove={() => remove(i)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </Box>
      <AddStepPills onAdd={addStep} />
    </Box>
  );
}

// ── Drag-sortable edit-mode rows ──────────────────────────────────────────────

function SortableActionRow({ action, onToggleFavourite, onEdit, onDelete }: {
  action: Action;
  onToggleFavourite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Prefixed so a group and an action that happen to share a name (and thus
  // the same toKebabId) don't collide in dnd-kit's id-keyed registry.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: `action:${action.id}` });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        ...EDIT_ROW_SX,
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : 'auto', position: 'relative',
      }}
    >
      <Box
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        sx={{ display: 'flex', alignItems: 'center', color: 'var(--text-dim)', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', flexShrink: 0 }}
      >
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '5px', backgroundColor: inferActionGlyph(action).bg, flexShrink: 0 }}>
        <ActionIcon icon={action.icon} action={action} status="idle" size={24} />
      </Box>
      <Box sx={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{action.name}</Box>
      <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-dim)', flexShrink: 0, display: { xs: 'none', sm: 'block' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
        {actionSummaryText(action)}
      </Box>
      {/* Star */}
      <Box onClick={onToggleFavourite} sx={{ flexShrink: 0, display: 'flex', color: action.favourite ? 'var(--warning)' : 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--warning)' }, '& .MuiSvgIcon-root': { fontSize: 16 } }}>
        {action.favourite ? <StarIcon /> : <StarBorderIcon />}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
        <EditOutlinedIcon onClick={onEdit} sx={{ fontSize: 16, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--accent)' } }} />
        <DeleteOutlineIcon onClick={onDelete} sx={{ fontSize: 16, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--error)' } }} />
      </Box>
    </Box>
  );
}

function GroupSection({
  group, items, editMode, isCollapsed, isRenaming, renameValue,
  onToggleCollapse, onStartRename, onRenameChange, onRenameKeyDown, onRenameBlur,
  onDeleteGroup, sectionView, onSectionViewChange, renderContent,
}: {
  group: ActionGroup;
  items: Action[];
  editMode: boolean;
  isCollapsed: boolean;
  isRenaming: boolean;
  renameValue: string;
  onToggleCollapse: () => void;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onRenameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onRenameBlur: () => void;
  onDeleteGroup: () => void;
  sectionView: SectionView;
  onSectionViewChange: (v: SectionView) => void;
  renderContent: () => React.ReactNode;
}) {
  // Prefixed so a group and an action that happen to share a name (and thus
  // the same toKebabId) don't collide in dnd-kit's id-keyed registry.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: `group:${group.id}`, disabled: !editMode });
  return (
    <Box ref={setNodeRef} sx={{ mb: 2.5, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : 'auto', position: 'relative' }}>
      {/* Group header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
        {editMode && (
          <Box
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            sx={{ display: 'flex', alignItems: 'center', color: 'var(--text-dim)', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', flexShrink: 0 }}
          >
            <DragIndicatorIcon sx={{ fontSize: 18 }} />
          </Box>
        )}
        <Box onClick={onToggleCollapse} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', flex: 1, minWidth: 0, '&:hover .group-label': { color: 'var(--text-secondary)' } }}>
          {isCollapsed ? <ExpandMoreIcon sx={{ fontSize: 14, color: 'var(--text-dim)', flexShrink: 0 }} /> : <ExpandLessIcon sx={{ fontSize: 14, color: 'var(--text-dim)', flexShrink: 0 }} />}
          {isRenaming ? (
            <input
              value={renameValue}
              onChange={e => onRenameChange(e.target.value)}
              onKeyDown={onRenameKeyDown}
              onBlur={onRenameBlur}
              autoFocus
              style={{ ...fieldStyle, padding: '0.15rem 0.4rem', fontSize: '0.7rem', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', width: 'auto', minWidth: 0, flex: 1 }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <Box className="group-label" sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--text-dim)', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {group.name}
            </Box>
          )}
          <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--border)', flexShrink: 0 }}>{items.length}</Box>
        </Box>
        {editMode && !isRenaming ? (
          <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
            <EditOutlinedIcon onClick={onStartRename} sx={{ fontSize: 15, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--accent)' } }} />
            <DeleteOutlineIcon onClick={onDeleteGroup} sx={{ fontSize: 15, color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--error)' } }} />
          </Box>
        ) : !isRenaming && (
          <ViewToggle current={sectionView} onChange={onSectionViewChange} />
        )}
      </Box>

      {!isCollapsed && renderContent()}
    </Box>
  );
}

// ── Manage Pages / Manage Groups dialogs ───────────────────────────────────────
// Global views over all pages/groups (regardless of which page is currently
// active) — supplement, not replace, the per-row rename/delete already
// available inline (GroupSection's rename/delete icons in edit mode). This
// is also the only place a Group's page can be changed after creation.

function ManagePagesDialog({ pages, deleteTarget, onAdd, onRename, onRequestDelete, onConfirmDelete, onCancelDelete, onClose }: {
  pages: ActionPage[]; // custom pages only — Home is implicit, shown read-only
  deleteTarget: ActionPage | null;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRequestDelete: (page: ActionPage) => void;
  onConfirmDelete: (page: ActionPage) => void;
  onCancelDelete: () => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const confirmAdd = () => { if (newName.trim()) { onAdd(newName.trim()); setNewName(''); setAdding(false); } };
  const confirmRename = (id: string) => { if (renameValue.trim()) onRename(id, renameValue.trim()); setRenamingId(null); };

  return (
    <ModalShell onClose={onClose} maxWidth={380}>
      <DialogHeader title="MANAGE PAGES" onClose={onClose} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.2, py: 0.9, borderRadius: '8px', border: '1px solid var(--border)', opacity: 0.7 }}>
          <Box sx={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Home</Box>
          <Box sx={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>ALWAYS PRESENT</Box>
        </Box>
        {pages.map(p => (
          <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.2, py: 0.9, borderRadius: '8px', border: '1px solid var(--border)' }}>
            {renamingId === p.id ? (
              <input
                autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmRename(p.id); if (e.key === 'Escape') setRenamingId(null); }}
                onBlur={() => confirmRename(p.id)}
                style={{ ...fieldStyle, flex: 1, padding: '0.3rem 0.5rem' }}
              />
            ) : (
              <Box onClick={() => { setRenamingId(p.id); setRenameValue(p.name); }} sx={{ fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', flex: 1 }}>{p.name}</Box>
            )}
            <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
              <Box onClick={() => { setRenamingId(p.id); setRenameValue(p.name); }} title={`Rename ${p.name}`} sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--accent)', backgroundColor: 'var(--accent-dim)' } }}>
                <EditOutlinedIcon sx={{ fontSize: 15 }} />
              </Box>
              <Box onClick={() => onRequestDelete(p)} title={`Delete ${p.name}`} sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--error)', backgroundColor: 'var(--error-dim)' } }}>
                <DeleteIcon sx={{ fontSize: 15 }} />
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      {adding ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 1.5, pt: 1.5, borderTop: '1px solid var(--border)' }}>
          <input
            autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Page name…"
            onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
            style={{ ...fieldStyle, flex: 1 }}
          />
          <Box onClick={confirmAdd} sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--accent)', cursor: 'pointer', '&:hover': { backgroundColor: 'var(--accent-dim)' } }}><CheckIcon sx={{ fontSize: 16 }} /></Box>
          <Box onClick={() => { setAdding(false); setNewName(''); }} sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer' }}><CloseIcon sx={{ fontSize: 16 }} /></Box>
        </Box>
      ) : (
        <Box
          onClick={() => setAdding(true)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, alignSelf: 'flex-start',
            fontSize: '0.74rem', color: 'var(--text-dim)', cursor: 'pointer',
            borderTop: '1px solid var(--border)', pt: 1.5, mt: 1.5, width: '100%',
            '&:hover': { color: 'var(--accent)' },
          }}
        >
          <AddIcon sx={{ fontSize: 14 }} /> ADD PAGE
        </Box>
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          title="DELETE PAGE"
          message={<>Delete <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</strong>? Its groups and actions move back to Home — nothing is deleted.</>}
          onConfirm={() => onConfirmDelete(deleteTarget)}
          onCancel={onCancelDelete}
        />
      )}
    </ModalShell>
  );
}

function ManageGroupsDialog({ groups, pages, activePageId, onAdd, onRename, onMove, onDelete, onClose }: {
  groups: ActionGroup[];
  pages: ActionPage[]; // custom pages only — Home is implicit
  activePageId: string;
  onAdd: (name: string, pageId?: string) => void;
  onRename: (id: string, name: string) => void;
  onMove: (id: string, pageId?: string) => void;
  onDelete: (group: ActionGroup) => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPageId, setNewPageId] = useState(activePageId);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ActionGroup | null>(null);

  const confirmAdd = () => { if (newName.trim()) { onAdd(newName.trim(), newPageId === HOME_PAGE_ID ? undefined : newPageId); setNewName(''); setAdding(false); } };
  const confirmRename = (id: string) => { if (renameValue.trim()) onRename(id, renameValue.trim()); setRenamingId(null); };
  const pageName = (id?: string) => id ? (pages.find(p => p.id === id)?.name ?? 'Home') : 'Home';

  return (
    <>
      <ModalShell onClose={onClose} maxWidth={420}>
        <DialogHeader title="MANAGE GROUPS" onClose={onClose} />
        {groups.length === 0 ? (
          <Box sx={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', py: 2 }}>No groups yet</Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.2 }}>
              <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)' }}>GROUP</Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)', width: 110, flexShrink: 0 }}>PAGE</Box>
                <Box sx={{ width: 30 + 30, flexShrink: 0 }} />
              </Box>
            </Box>
            {groups.map(g => (
              <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.2, py: 0.9, borderRadius: '8px', border: '1px solid var(--border)' }}>
                {renamingId === g.id ? (
                  <input
                    autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmRename(g.id); if (e.key === 'Escape') setRenamingId(null); }}
                    onBlur={() => confirmRename(g.id)}
                    style={{ ...fieldStyle, flex: 1, padding: '0.3rem 0.5rem' }}
                  />
                ) : (
                  <Box onClick={() => { setRenamingId(g.id); setRenameValue(g.name); }} sx={{ minWidth: 0, cursor: 'pointer' }}>
                    <Box sx={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{g.name}</Box>
                  </Box>
                )}
                <select
                  value={g.pageId ?? HOME_PAGE_ID}
                  onChange={e => onMove(g.id, e.target.value === HOME_PAGE_ID ? undefined : e.target.value)}
                  title="Move to page"
                  style={{ ...fieldStyle, width: 110, padding: '0.3rem 0.4rem', fontSize: '0.7rem', flexShrink: 0 }}
                >
                  <option value={HOME_PAGE_ID}>Home</option>
                  {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                  <Box onClick={() => { setRenamingId(g.id); setRenameValue(g.name); }} title={`Rename ${g.name}`} sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--accent)', backgroundColor: 'var(--accent-dim)' } }}>
                    <EditOutlinedIcon sx={{ fontSize: 15 }} />
                  </Box>
                  <Box onClick={() => setDeleteTarget(g)} title={`Delete ${g.name}`} sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer', '&:hover': { color: 'var(--error)', backgroundColor: 'var(--error-dim)' } }}>
                    <DeleteIcon sx={{ fontSize: 15 }} />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {adding ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 1.5, pt: 1.5, borderTop: groups.length > 0 ? '1px solid var(--border)' : 'none' }}>
            <input
              autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Group name…"
              onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
              style={{ ...fieldStyle, flex: 1 }}
            />
            <select value={newPageId} onChange={e => setNewPageId(e.target.value)} style={{ ...fieldStyle, width: 100, padding: '0.3rem 0.4rem', fontSize: '0.7rem', flexShrink: 0 }}>
              <option value={HOME_PAGE_ID}>Home</option>
              {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Box onClick={confirmAdd} sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--accent)', cursor: 'pointer', '&:hover': { backgroundColor: 'var(--accent-dim)' } }}><CheckIcon sx={{ fontSize: 16 }} /></Box>
            <Box onClick={() => { setAdding(false); setNewName(''); }} sx={{ display: 'flex', p: 0.7, borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer' }}><CloseIcon sx={{ fontSize: 16 }} /></Box>
          </Box>
        ) : (
          <Box
            onClick={() => { setNewPageId(activePageId); setAdding(true); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, alignSelf: 'flex-start',
              fontSize: '0.74rem', color: 'var(--text-dim)', cursor: 'pointer',
              borderTop: groups.length > 0 ? '1px solid var(--border)' : 'none',
              pt: groups.length > 0 ? 1.5 : 0, mt: groups.length > 0 ? 1.5 : 0, width: '100%',
              '&:hover': { color: 'var(--accent)' },
            }}
          >
            <AddIcon sx={{ fontSize: 14 }} /> ADD GROUP
          </Box>
        )}
      </ModalShell>
      {deleteTarget && (
        <DeleteConfirmDialog
          title="DELETE GROUP"
          message={<>Delete <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</strong>? Its actions become ungrouped — nothing is deleted.</>}
          onConfirm={() => { onDelete(deleteTarget); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ActionsSection() {
  const [editMode, setEditMode] = useState(false);
  const [dialog, setDialog] = useState<Action | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; referencedBy: string[] } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Action | null>(null);
  const [cardStatuses, setCardStatuses] = useState<Record<string, CardStatus>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('action-collapsed') ?? '{}'); } catch { return {}; }
  });
  const [sectionViews, setSectionViewsState] = useState<Record<string, SectionView>>(() => {
    try { return JSON.parse(localStorage.getItem('action-section-views') ?? '{}'); } catch { return {}; }
  });
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [activePageId, setActivePageIdState] = useState<string>(() => {
    try { return localStorage.getItem('action-active-page') || HOME_PAGE_ID; } catch { return HOME_PAGE_ID; }
  });
  const [deletePageTarget, setDeletePageTarget] = useState<ActionPage | null>(null);
  const [managingPages, setManagingPages] = useState(false);
  const [managingGroups, setManagingGroups] = useState(false);

  const { data: config } = useAppConfig();
  const { mutateAsync: updateConfig, isPending: saving } = useUpdateAppConfig();
  const { mutate: execAction } = useExecuteAction();
  const isLocalhost = useIsLocalhost();
  const { has } = useGrants();
  const canExecute = has('actions:execute');
  // Action/group CRUD persists via the generic config blob, gated settings:write
  // (same pattern as the old Modes) — see CLAUDE.md's Permission Grants note.
  const canManage = has('settings:write');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const actions = config?.actions ?? [];
  const groups = config?.actionGroups ?? [];
  const pages = config?.actionPages ?? [];
  const allPages: ActionPage[] = [{ id: HOME_PAGE_ID, name: 'Home' }, ...pages];

  // Self-heals a stale cached activePageId (e.g. localStorage still points
  // at a page that's since been deleted — possibly from another paired
  // device) back to Home. Without this, a new action's pageId silently
  // defaults to the dangling id and the action becomes invisible (it
  // matches no real page's filter) — found live: deleting a page in one
  // session, then adding an action in a session that still had that page
  // cached as active, produced exactly this.
  useEffect(() => {
    if (config && !allPages.some(p => p.id === activePageId)) setActivePage(HOME_PAGE_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, activePageId]);

  function setActivePage(id: string) {
    setActivePageIdState(id);
    try { localStorage.setItem('action-active-page', id); } catch {}
  }

  const groupPageId = (g: ActionGroup) => g.pageId ?? HOME_PAGE_ID;
  // A grouped action always follows its group's page; an ungrouped action
  // carries its own pageId. Favourites are scoped by this too — favouriting
  // an action on Page 2 shows it under Page 2's FAVOURITES, not every page's.
  const actionEffectivePageId = (a: Action) => {
    if (a.groupId) {
      const g = groups.find(gr => gr.id === a.groupId);
      return g ? groupPageId(g) : HOME_PAGE_ID;
    }
    return a.pageId ?? HOME_PAGE_ID;
  };

  async function addPage(name: string) {
    if (!config || !name.trim()) return;
    const page: ActionPage = { id: `${toKebabId(name)}-${Date.now().toString(36)}`, name: name.trim() };
    await updateConfig({ ...config, actionPages: [...config.actionPages, page] });
    setActivePage(page.id);
  }

  async function renamePage(pageId: string, name: string) {
    if (!config || !name.trim()) return;
    await updateConfig({ ...config, actionPages: config.actionPages.map(p => p.id === pageId ? { ...p, name: name.trim() } : p) });
  }

  // Deleting a page ungroups nothing — it reassigns its groups and ungrouped
  // actions back to Home (pageId cleared), same "don't lose data, just fall
  // back to the default bucket" approach as deleteGroup below.
  async function deletePage(pageId: string) {
    if (!config) return;
    await updateConfig({
      ...config,
      actionPages: config.actionPages.filter(p => p.id !== pageId),
      actionGroups: config.actionGroups.map(g => g.pageId === pageId ? { ...g, pageId: undefined } : g),
      actions: config.actions.map(a => a.pageId === pageId ? { ...a, pageId: undefined } : a),
    });
    setDeletePageTarget(null);
    if (activePageId === pageId) setActivePage(HOME_PAGE_ID);
  }

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('action-collapsed', JSON.stringify(next));
      return next;
    });
  }

  function setSectionView(id: string, view: SectionView) {
    setSectionViewsState(prev => {
      const next = { ...prev, [id]: view };
      localStorage.setItem('action-section-views', JSON.stringify(next));
      return next;
    });
  }

  function getSectionView(id: string): SectionView {
    return sectionViews[id] ?? 'grid';
  }

  function setStatus(id: string, status: CardStatus) {
    setCardStatuses(s => ({ ...s, [id]: status }));
    if (status === 'ok' || status === 'error') setTimeout(() => setCardStatuses(s => ({ ...s, [id]: 'idle' })), 2000);
  }

  function handleRun(action: Action) {
    if (!canExecute) {
      showToast("You don't have permission to run actions.", 'error');
      return;
    }
    if (action.requireConfirmation) {
      setConfirmTarget(action);
      return;
    }
    executeNow(action);
  }

  function executeNow(action: Action) {
    setConfirmTarget(null);
    setStatus(action.id, 'running');
    execAction(action.id, {
      onSuccess: () => setStatus(action.id, 'ok'),
      onError: () => setStatus(action.id, 'error'),
    });
  }

  async function handleSave(action: Action, newGroupName?: string, newGroupPageId?: string, newPageName?: string) {
    if (!config) return;
    let actionGroups = config.actionGroups;
    if (newGroupName && action.groupId && !actionGroups.find(g => g.id === action.groupId)) {
      actionGroups = [...actionGroups, { id: action.groupId, name: newGroupName, pageId: newGroupPageId }];
    }
    let actionPages = config.actionPages;
    if (newPageName && action.pageId && !actionPages.find(p => p.id === action.pageId)) {
      actionPages = [...actionPages, { id: action.pageId, name: newPageName }];
    }
    const idx = config.actions.findIndex(a => a.id === action.id);
    const newActions = idx >= 0 ? config.actions.map((a, i) => i === idx ? action : a) : [...config.actions, action];
    await updateConfig({ ...config, actionGroups, actionPages, actions: newActions });
    setDialog(null);
  }

  function initiateDelete(id: string, name: string) {
    const referencedBy = actions
      .filter(a => a.steps.some(step => step.type === 'macro' && step.macroId === id))
      .map(a => a.name);
    setDeleteTarget({ id, name, referencedBy });
  }

  async function handleDelete(id: string) {
    if (!config) return;
    await updateConfig({ ...config, actions: config.actions.filter(a => a.id !== id) });
    setDeleteTarget(null);
  }

  async function toggleFavourite(id: string) {
    if (!config) return;
    await updateConfig({ ...config, actions: config.actions.map(a => a.id === id ? { ...a, favourite: !a.favourite } : a) });
  }

  // Drag-reorder within a section: reorders just the section's members (by
  // dragged-from/to id), then writes them back at their original positions
  // in the full array.
  async function reorderInSection(sectionFilter: (a: Action) => boolean, activeId: string, overId: string) {
    if (!config) return;
    const indices = config.actions.reduce<number[]>((acc, a, i) => sectionFilter(a) ? [...acc, i] : acc, []);
    const section = indices.map(i => config.actions[i]);
    const oldIndex = section.findIndex(a => a.id === activeId);
    const newIndex = section.findIndex(a => a.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    const reordered = arrayMove(section, oldIndex, newIndex);
    const arr = [...config.actions];
    indices.forEach((origIdx, k) => { arr[origIdx] = reordered[k]; });
    await updateConfig({ ...config, actions: arr });
  }

  // Single handler for the whole GROUPS area: dnd-kit doesn't support nesting
  // one <DndContext> inside another (only nesting <SortableContext>s within
  // one shared <DndContext> is supported), so group reordering and
  // item-within-a-group reordering share this one context/handler —
  // dispatched by whether the dragged id is a group id or an action id.
  // `pageId` is the page whose GROUPS area is being dragged in — bound per
  // page (not read from `activePageId`) since SwipeableTabs keeps every
  // page's content mounted, so this must stay correct even for a page
  // that isn't the currently-visible one.
  function makeGroupsAreaDragEndHandler(pageId: string) {
    return ({ active, over }: DragEndEvent) => {
      if (!config || !over || active.id === over.id) return;
      const activeRaw = String(active.id);
      const overRaw = String(over.id);

      if (activeRaw.startsWith('group:')) {
        const activeId = activeRaw.slice('group:'.length);
        const overId = overRaw.slice('group:'.length);
        // Reorder within just this page's groups (the only ones rendered/
        // sortable together), then splice back at their original positions
        // in the full array — same index-preserving approach as
        // reorderInSection, since groups from other pages aren't part of
        // this drag at all.
        const indices = groups.reduce<number[]>((acc, g, i) => groupPageId(g) === pageId ? [...acc, i] : acc, []);
        const section = indices.map(i => groups[i]);
        const oldIndex = section.findIndex(g => g.id === activeId);
        const newIndex = section.findIndex(g => g.id === overId);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(section, oldIndex, newIndex);
        const arr = [...groups];
        indices.forEach((origIdx, k) => { arr[origIdx] = reordered[k]; });
        updateConfig({ ...config, actionGroups: arr });
        return;
      }

      const activeId = activeRaw.slice('action:'.length);
      const overId = overRaw.slice('action:'.length);

      const activeAction = config.actions.find(a => a.id === activeId);
      if (!activeAction?.groupId) return;
      reorderInSection(a => a.groupId === activeAction.groupId, activeId, overId);
    };
  }

  async function deleteGroup(groupId: string) {
    if (!config) return;
    await updateConfig({
      ...config,
      actionGroups: config.actionGroups.filter(g => g.id !== groupId),
      actions: config.actions.map(a => a.groupId === groupId ? { ...a, groupId: undefined } : a),
    });
  }

  async function renameGroup(groupId: string, name: string) {
    if (!config || !name.trim()) return;
    await updateConfig({ ...config, actionGroups: config.actionGroups.map(g => g.id === groupId ? { ...g, name: name.trim() } : g) });
    setRenamingGroup(null);
  }

  // Creates an empty group directly (no action assigned yet) — the
  // MANAGE GROUPS dialog's own add flow, separate from ActionDialog's
  // "+ New group…" (which only creates one as a side effect of assigning
  // an action to it).
  async function addGroup(name: string, pageId?: string) {
    if (!config || !name.trim()) return;
    const group: ActionGroup = { id: `${toKebabId(name)}-${Date.now().toString(36)}`, name: name.trim(), pageId };
    await updateConfig({ ...config, actionGroups: [...config.actionGroups, group] });
  }

  async function moveGroupToPage(groupId: string, pageId?: string) {
    if (!config) return;
    await updateConfig({ ...config, actionGroups: config.actionGroups.map(g => g.id === groupId ? { ...g, pageId } : g) });
  }

  // ── Section renderers ──────────────────────────────────────────────────────

  function renderListView(items: Action[]) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {items.map(a => {
          const status = cardStatuses[a.id] ?? 'idle';
          const glyph = inferActionGlyph(a);
          const singleHotkeyStep = a.steps.length === 1 && a.steps[0].type === 'hotkey' ? a.steps[0] : null;
          const busy = status === 'running';
          return (
            <Box
              key={a.id}
              onClick={!busy ? () => handleRun(a) : undefined}
              {...helpProps(a.name, actionHelpBody(a))}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.25,
                px: 1.25, py: 0.875, borderRadius: '10px',
                border: `1px solid ${BORDER_COLOR(status)}`,
                background: 'linear-gradient(145deg, var(--bg-raised) 0%, var(--bg-base) 100%)',
                cursor: busy ? 'default' : 'pointer',
                transition: 'all 0.15s',
                '&:hover': !busy ? { borderColor: 'var(--accent)', transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' } : {},
              }}
            >
              <Box sx={{ width: 28, height: 28, borderRadius: '7px', flexShrink: 0, backgroundColor: glyph.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ActionIcon icon={a.icon} action={a} status={status} size={28} />
              </Box>
              <Box sx={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</Box>
              {singleHotkeyStep ? (
                <Box sx={{ display: 'flex', gap: 0.4, flexShrink: 0 }}>
                  {singleHotkeyStep.keys.map((k, i) => (
                    <Box key={i} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                      <KeyChip k={k} />
                      {i < singleHotkeyStep.keys.length - 1 && <Box sx={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>+</Box>}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)', flexShrink: 0, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {actionSummaryText(a)}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    );
  }

  function renderGrid(items: Action[], viewStyle: SectionView) {
    if (viewStyle === 'compact') {
      return (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 1.5 }}>
          {items.map(a => <ActionCard key={a.id} action={a} iconOnly status={cardStatuses[a.id] ?? 'idle'} onActivate={() => handleRun(a)} />)}
        </Box>
      );
    }
    if (viewStyle === 'list') return renderListView(items);
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 1.5 }}>
        {items.map(a => <ActionCard key={a.id} action={a} status={cardStatuses[a.id] ?? 'idle'} onActivate={() => handleRun(a)} />)}
      </Box>
    );
  }

  // Raw sortable rows with no <DndContext> of their own — used both standalone
  // (wrapped by renderEditRows below, for favourites/ungrouped) and nested
  // inside the GROUPS area's single shared <DndContext> (see
  // handleGroupsAreaDragEnd's comment for why it can't have its own).
  function renderGroupItemRows(items: Action[]) {
    return (
      <SortableContext items={items.map(a => `action:${a.id}`)} strategy={verticalListSortingStrategy}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {items.map(a => (
            <SortableActionRow
              key={a.id}
              action={a}
              onToggleFavourite={() => toggleFavourite(a.id)}
              onEdit={() => setDialog(a)}
              onDelete={() => initiateDelete(a.id, a.name)}
            />
          ))}
        </Box>
      </SortableContext>
    );
  }

  function renderEditRows(items: Action[], sectionFilter: (a: Action) => boolean) {
    return (
      <DndContext sensors={sensors} onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const activeId = String(active.id).slice('action:'.length);
        const overId = String(over.id).slice('action:'.length);
        reorderInSection(sectionFilter, activeId, overId);
      }}>
        {renderGroupItemRows(items)}
      </DndContext>
    );
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const byGroup    = (gid: string) => actions.filter(a => a.groupId === gid);

  const isEmpty = actions.length === 0;

  // Renders one page's FAVOURITES + GROUPS + UNGROUPED content — used both
  // for the single-page case (no SwipeableTabs at all, since most users
  // never add a second page) and as each SwipeTab's content once they do.
  // Favourites are scoped per page (see actionEffectivePageId) — favouriting
  // something on Page 2 surfaces it under Page 2's FAVOURITES, not every page's.
  function renderPageContent(page: ActionPage) {
    const pageFavourites = actions.filter(a => a.favourite && actionEffectivePageId(a) === page.id);
    const pageGroups = groups.filter(g => groupPageId(g) === page.id);
    const pageUngrouped = actions.filter(a => !a.groupId && (a.pageId ?? HOME_PAGE_ID) === page.id);
    const ungroupedKey = `ungrouped-${page.id}`;
    const ungroupedFilter = (a: Action) => !a.groupId && (a.pageId ?? HOME_PAGE_ID) === page.id;
    const favouritesFilter = (a: Action) => !!a.favourite && actionEffectivePageId(a) === page.id;

    return (
      <Box key={page.id}>
        {/* FAVOURITES */}
        {pageFavourites.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Box sx={{ ...SECTION_HEADER_SX, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StarIcon sx={{ fontSize: 13, color: 'var(--warning)' }} />
                FAVOURITES
              </Box>
              {!editMode && <ViewToggle current={getSectionView(`favourites-${page.id}`)} onChange={v => setSectionView(`favourites-${page.id}`, v)} />}
            </Box>
            {editMode ? renderEditRows(pageFavourites, favouritesFilter) : renderGrid(pageFavourites, getSectionView(`favourites-${page.id}`))}
          </Box>
        )}

        {/* GROUPS */}
        <DndContext sensors={sensors} onDragEnd={makeGroupsAreaDragEndHandler(page.id)}>
          <SortableContext items={pageGroups.map(g => `group:${g.id}`)} strategy={verticalListSortingStrategy}>
            {pageGroups.map(group => {
              const items = byGroup(group.id);
              if (items.length === 0 && !editMode) return null;
              const isCollapsed = !!collapsed[group.id];
              const isRenaming = renamingGroup === group.id;
              return (
                <GroupSection
                  key={group.id}
                  group={group}
                  items={items}
                  editMode={editMode}
                  isCollapsed={isCollapsed}
                  isRenaming={isRenaming}
                  renameValue={renameValue}
                  onToggleCollapse={() => toggleCollapse(group.id)}
                  onStartRename={() => { setRenamingGroup(group.id); setRenameValue(group.name); }}
                  onRenameChange={setRenameValue}
                  onRenameKeyDown={e => { if (e.key === 'Enter') renameGroup(group.id, renameValue); if (e.key === 'Escape') setRenamingGroup(null); }}
                  onRenameBlur={() => renameGroup(group.id, renameValue)}
                  onDeleteGroup={() => deleteGroup(group.id)}
                  sectionView={getSectionView(group.id)}
                  onSectionViewChange={v => setSectionView(group.id, v)}
                  renderContent={() => editMode ? renderGroupItemRows(items) : renderGrid(items, getSectionView(group.id))}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* UNGROUPED */}
        {pageUngrouped.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Box sx={{ ...SECTION_HEADER_SX, color: 'var(--border)', justifyContent: 'space-between' }}>
              {(pageFavourites.length > 0 || pageGroups.length > 0) ? 'OTHER' : <span />}
              {!editMode && <ViewToggle current={getSectionView(ungroupedKey)} onChange={v => setSectionView(ungroupedKey, v)} />}
            </Box>
            {editMode ? renderEditRows(pageUngrouped, ungroupedFilter) : renderGrid(pageUngrouped, getSectionView(ungroupedKey))}
          </Box>
        )}

        {pageGroups.length === 0 && pageUngrouped.length === 0 && pageFavourites.length === 0 && !isEmpty && (
          <Box sx={{ textAlign: 'center', py: 4, color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            Nothing on this page yet{isLocalhost ? ' — set an action’s Page (or a group’s) to move it here' : ''}
          </Box>
        )}
      </Box>
    );
  }

  const pageTabs = allPages.map(page => ({ id: page.id, label: page.name.toUpperCase(), content: renderPageContent(page) }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
        {saving && <CircularProgress size={14} sx={{ color: 'var(--accent)', mr: 'auto' }} />}
        {isLocalhost && (
          <Box
            onClick={() => setDialog('new')}
            {...helpProps('Add', 'Creates a new Action — a named sequence of one or more steps (launch a program, send a hotkey, play a key sequence, switch display/audio/fan, or run another Action) that runs in one tap.')}
            {...tipProps('actions-add')}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.65, borderRadius: 7, backgroundColor: 'var(--accent)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', '&:hover': { backgroundColor: 'rgba(59,130,246,0.85)' }, transition: 'background 0.15s' }}
          >
            <AddIcon sx={{ fontSize: 15 }} />ADD
          </Box>
        )}
        {canManage && (
          <Box
            onClick={() => setManagingGroups(true)}
            {...helpProps('Manage Groups', 'Groups are folders for related Actions on the current Page — create, rename, reorder, or delete them, and drag Actions between them from EDIT mode below.')}
            sx={{ px: 1.5, py: 0.65, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' }, transition: 'all 0.15s' }}
          >
            MANAGE GROUPS
          </Box>
        )}
        {canManage && (
          <Box
            onClick={() => setManagingPages(true)}
            {...helpProps('Manage Pages', "Pages are separate swipeable screens of Actions — useful once you have enough Actions that scrolling one long list gets unwieldy. A single page's Actions show with no tab strip at all; add a second Page here to split them up.")}
            sx={{ px: 1.5, py: 0.65, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' }, transition: 'all 0.15s' }}
          >
            MANAGE PAGES
          </Box>
        )}
        {canManage && (
          <Box
            onClick={() => setEditMode(v => !v)}
            {...helpProps('Edit', 'Switches the grid to a reorderable list — drag Actions to reorder or move them between Groups, and reach the favourite/edit/delete controls for each one directly.')}
            sx={{ px: 1.5, py: 0.65, borderRadius: 7, border: `1px solid ${editMode ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: editMode ? 'rgba(59,130,246,0.1)' : 'transparent', color: editMode ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 0.5, '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' }, transition: 'all 0.15s' }}
          >
            <EditOutlinedIcon sx={{ fontSize: 14 }} />{editMode ? 'DONE' : 'EDIT'}
          </Box>
        )}
      </Box>

      {!canExecute && (
        <Box sx={{ mb: 2, px: 1.5, py: 1, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', fontSize: '0.75rem', color: 'var(--warning)', lineHeight: 1.5 }}>
          You don't have permission to run actions from this device.
        </Box>
      )}

      {editMode && !isLocalhost && (
        <Box sx={{ mb: 2, px: 1.5, py: 1, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', fontSize: '0.75rem', color: 'var(--warning)', lineHeight: 1.5 }}>
          New actions can only be created from the host PC — connect from the host to add one. You can still edit display settings on existing actions from here.
        </Box>
      )}

      {isEmpty && !editMode && (
        <Box sx={{ textAlign: 'center', py: 6, color: 'var(--text-dim)', fontSize: '0.82rem' }}>No actions yet — tap <strong>ADD</strong> to create one</Box>
      )}

      {/* PAGES — a lightweight tab strip only appears once a second page
          exists; most users never add one, so the single-page case renders
          exactly like before (just that page's content, no tab strip). Page
          management lives in the MANAGE PAGES dialog (edit mode only). */}
      {allPages.length > 1 ? (
        <SwipeableTabs tabs={pageTabs} activeId={activePageId} onChange={setActivePage} swipeEnabled={!editMode} />
      ) : (
        renderPageContent(allPages[0])
      )}

      {/* Dialogs */}
      {dialog && (
        <ActionDialog
          action={dialog === 'new' ? { ...emptyAction(), pageId: activePageId === HOME_PAGE_ID ? undefined : activePageId } : dialog}
          actions={actions} groups={groups} pages={pages} activePageId={activePageId} isLocalhost={isLocalhost}
          onSave={handleSave} onClose={() => setDialog(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmDialog
          title="DELETE ACTION"
          message={<>Delete <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</strong>? This cannot be undone.</>}
          blockedMessage={deleteTarget.referencedBy.length > 0 ? (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</strong> is used in{' '}
              {deleteTarget.referencedBy.length === 1 ? 'this sequence' : 'these sequences'}:{' '}
              <strong style={{ color: 'var(--warning)' }}>{deleteTarget.referencedBy.join(', ')}</strong>.
              <br />Remove it from those sequences first.
            </>
          ) : undefined}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {managingPages && (
        <ManagePagesDialog
          pages={pages}
          deleteTarget={deletePageTarget}
          onAdd={addPage}
          onRename={renamePage}
          onRequestDelete={setDeletePageTarget}
          onConfirmDelete={p => deletePage(p.id)}
          onCancelDelete={() => setDeletePageTarget(null)}
          onClose={() => setManagingPages(false)}
        />
      )}
      {managingGroups && (
        <ManageGroupsDialog
          groups={groups}
          pages={pages}
          activePageId={activePageId}
          onAdd={addGroup}
          onRename={renameGroup}
          onMove={moveGroupToPage}
          onDelete={g => deleteGroup(g.id)}
          onClose={() => setManagingGroups(false)}
        />
      )}
      {confirmTarget && createPortal(
        <Box sx={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }} onClick={() => setConfirmTarget(null)}>
          <Box sx={{ width: '100%', maxWidth: 320, backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '12px', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }} onClick={e => e.stopPropagation()}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '10px', flexShrink: 0, backgroundColor: inferActionGlyph(confirmTarget).bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ActionIcon icon={confirmTarget.icon} action={confirmTarget} status="idle" size={40} />
              </Box>
              <Box>
                <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>{confirmTarget.name}</Box>
                <Box sx={{ fontSize: '0.72rem', color: 'var(--text-dim)', mt: 0.25 }}>Confirm before running</Box>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Box onClick={() => setConfirmTarget(null)} sx={{ px: 2, py: 0.75, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem', '&:hover': { backgroundColor: 'var(--border)' } }}>CANCEL</Box>
              <Box onClick={() => executeNow(confirmTarget)} sx={{ px: 2, py: 0.75, borderRadius: 7, backgroundColor: 'var(--accent)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem' }}>RUN</Box>
            </Box>
          </Box>
        </Box>,
        document.body
      )}
    </Box>
  );
}
