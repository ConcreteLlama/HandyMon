// Single source of truth for the permission-grant vocabulary — used by both
// backend route guards (requireGrant) and the PermissionsEditor UI.

export const GRANT_GROUPS = [
  {
    id: 'actions', label: 'Actions',
    grants: [
      { id: 'actions:read',    label: 'View',      kind: 'read' },
      { id: 'actions:execute', label: 'Run',        kind: 'action' },
      { id: 'actions:edit',    label: 'Create/Edit', kind: 'action' },
    ],
  },
  {
    id: 'displayoutput', label: 'Output',
    grants: [
      { id: 'displayoutput:read',  label: 'View',              kind: 'read' },
      { id: 'displayoutput:write', label: 'Switch / Control',  kind: 'action' },
    ],
  },
  {
    id: 'gaming', label: 'Gaming',
    grants: [
      { id: 'gaming:read',  label: 'View',        kind: 'read' },
      { id: 'gaming:write', label: 'Edit / Apply', kind: 'action' },
    ],
  },
  {
    id: 'perf', label: 'Performance',
    grants: [
      { id: 'perf:read',    label: 'View stats',   kind: 'read' },
      { id: 'perf:capture', label: 'Capture runs', kind: 'action' },
    ],
  },
  {
    id: 'processes', label: 'Processes',
    grants: [
      { id: 'processes:read',  label: 'View',  kind: 'read' },
      { id: 'processes:focus', label: 'Bring to front', kind: 'action' },
      { id: 'processes:kill',  label: 'Kill',  kind: 'action' },
    ],
  },
  {
    id: 'processlasso', label: 'Process Lasso',
    grants: [
      { id: 'processlasso:read',  label: 'View',          kind: 'read' },
      { id: 'processlasso:write', label: 'Edit CPU sets', kind: 'action' },
    ],
  },
  {
    id: 'fans', label: 'Fans',
    grants: [
      { id: 'fans:read',  label: 'View',            kind: 'read' },
      { id: 'fans:write', label: 'Change profile',  kind: 'action' },
    ],
  },
  {
    id: 'services', label: 'Services',
    grants: [
      { id: 'services:read',    label: 'View',                       kind: 'read' },
      { id: 'services:control', label: 'Start / Stop (where allowed)', kind: 'action' },
    ],
  },
  {
    id: 'keyboard', label: 'Keyboard',
    grants: [
      { id: 'keyboard:execute', label: 'Type / Send keys', kind: 'action' },
    ],
  },
  {
    id: 'settings', label: 'Settings',
    grants: [
      { id: 'settings:read',  label: 'View', kind: 'read' },
      { id: 'settings:write', label: 'Edit', kind: 'action' },
    ],
  },
  {
    id: 'appearance', label: 'Appearance',
    grants: [
      // Selecting an existing theme (predefined or custom) is unrestricted —
      // it's a local-only, harmless per-device preference. This only gates
      // creating/editing/deleting custom themes, which are shared config
      // (visible to every paired device) rather than local state.
      { id: 'appearance:write', label: 'Manage custom themes', kind: 'action' },
    ],
  },
] as const;

export type Grant = typeof GRANT_GROUPS[number]['grants'][number]['id'];

export const ALL_GRANTS: Grant[] = GRANT_GROUPS.flatMap(g => g.grants.map(x => x.id));
export const READ_GRANTS: Grant[] = GRANT_GROUPS.flatMap(g => g.grants.filter(x => x.kind === 'read').map(x => x.id));
export const ACTION_GRANTS: Grant[] = GRANT_GROUPS.flatMap(g => g.grants.filter(x => x.kind === 'action').map(x => x.id));
