import _ from 'lodash';
import { ProcessRulePreset } from '@/types/app-config';
import { CpuPriorityLevel, IoPriorityLevel } from './process-lasso';

// Collapses a set of core indices into a compact range string, e.g.
// [0,1,2,3,5,7,8] -> "0-3, 5, 7-8" (or "0-3;5;7-8" with separator ';').
export function formatCoreRanges(cores: number[], separator = ', '): string {
  const sorted = [...new Set(cores)].sort((a, b) => a - b);
  const segments: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i];
    let end = start;
    while (sorted[i + 1] === end + 1) end = sorted[++i];
    segments.push(start === end ? `${start}` : `${start}-${end}`);
    i++;
  }
  return segments.join(separator);
}

// Human-readable label for a core set: the matching saved preset's name if
// one matches exactly, otherwise a range summary.
export function describeCoreSet(cores: number[], presets: ProcessRulePreset[]): string {
  const sorted = [...cores].sort((a, b) => a - b);
  const match = presets.find(p => p.cores && _.isEqual([...p.cores].sort((a, b) => a - b), sorted));
  if (match) return match.label;
  return cores.length === 0 ? 'No cores' : `Cores ${formatCoreRanges(cores)}`;
}

// Finds the BEST-matching preset for a process rule's CURRENT cores/
// priority/cpuPriority/performanceMode — used to infer "this process is
// effectively using preset X" without storing any explicit link (values
// could drift out of sync with an explicit link; a plain value match
// self-heals, but does mean editing a rule's values by hand silently stops
// it matching, which is the correct behavior here). Only fields the preset
// actually defines are checked — a cores-only preset matches on cores alone,
// ignoring the rule's other fields. A preset defining none of the four
// fields never matches anything (nothing to check).
//
// "Best" = matches on the most fields — e.g. if a rule's cores happen to
// equal both a cores-only "CCD0" preset AND a cores+priority "Game" preset
// (and the rule's priority also matches Game's), Game wins since it explains
// more of the rule's actual configuration, not just whichever preset
// happens to come first in the list.
export function matchProcessRulePreset(
  cores: number[] | undefined,
  priority: IoPriorityLevel | undefined,
  presets: ProcessRulePreset[],
  cpuPriority?: CpuPriorityLevel,
  performanceMode?: boolean,
): ProcessRulePreset | undefined {
  const sortedCores = cores ? [...cores].sort((a, b) => a - b) : undefined;
  const matches = presets.filter(p => {
    if (!p.cores && p.ioPriority === undefined && p.cpuPriority === undefined && p.performanceMode === undefined) return false;
    if (p.cores && !_.isEqual([...p.cores].sort((a, b) => a - b), sortedCores ?? [])) return false;
    if (p.ioPriority !== undefined && p.ioPriority !== priority) return false;
    if (p.cpuPriority !== undefined && p.cpuPriority !== cpuPriority) return false;
    if (p.performanceMode !== undefined && p.performanceMode !== !!performanceMode) return false;
    return true;
  });
  if (matches.length === 0) return undefined;
  const specificity = (p: ProcessRulePreset) =>
    (p.cores ? 1 : 0) + (p.ioPriority !== undefined ? 1 : 0) + (p.cpuPriority !== undefined ? 1 : 0) + (p.performanceMode !== undefined ? 1 : 0);
  return matches.reduce((best, p) => specificity(p) > specificity(best) ? p : best);
}
