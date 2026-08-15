export interface BrowseEntry {
  name: string;
  path: string;
  type: 'directory' | 'executable' | 'file';
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
  quickAccess: { label: string; path: string }[];
}
