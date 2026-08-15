import TvIcon from '@mui/icons-material/Tv';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import TuneIcon from '@mui/icons-material/Tune';
import SettingsIcon from '@mui/icons-material/Settings';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import MemoryIcon from '@mui/icons-material/Memory';
import type { SvgIconComponent } from '@mui/icons-material';

export type SectionId = 'actions' | 'output' | 'gaming' | 'perf' | 'processes' | 'system' | 'keyboard' | 'settings';

export interface NavItem {
  id: SectionId;
  label: string;
  Icon: SvgIconComponent;
}

// Canonical nav items in their default order — also the source of truth for
// which section ids exist at all. A user's saved navOrder (AppConfig) only
// ever reorders this list, via orderNavItems() below.
export const NAV_ITEMS: NavItem[] = [
  { id: 'actions',   label: 'Actions',   Icon: ShortcutIcon },
  { id: 'output',    label: 'Output',    Icon: TvIcon },
  { id: 'gaming',    label: 'Gaming',    Icon: SportsEsportsIcon },
  { id: 'perf',      label: 'Perf',      Icon: MonitorHeartIcon },
  { id: 'processes', label: 'Processes', Icon: MemoryIcon },
  { id: 'system',    label: 'System',    Icon: TuneIcon },
  { id: 'keyboard',  label: 'Keyboard',  Icon: KeyboardIcon },
  { id: 'settings',  label: 'Settings',  Icon: SettingsIcon },
];

// Applies a saved id order to NAV_ITEMS. Ids in `order` that no longer exist
// are ignored; NAV_ITEMS entries not mentioned in `order` (e.g. a section
// added by a later app update, or no order saved at all) are appended at the
// end in their default relative order.
export function orderNavItems(order?: string[]): NavItem[] {
  if (!order || order.length === 0) return NAV_ITEMS;
  const byId = new Map(NAV_ITEMS.map(n => [n.id, n]));
  const ordered = order.map(id => byId.get(id as SectionId)).filter((n): n is NavItem => !!n);
  const includedIds = new Set(ordered.map(n => n.id));
  const missing = NAV_ITEMS.filter(n => !includedIds.has(n.id));
  return [...ordered, ...missing];
}
