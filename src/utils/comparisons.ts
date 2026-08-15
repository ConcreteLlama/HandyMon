import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync, copyFileSync } from 'fs';
import path from 'path';
import type { ComparisonManifest, ComparisonListItem, ComparisonRunStatus, ComparisonVariant, CaptureRunSummary } from '@/types/perf';
import { CAPTURES_DIR, readCaptureData, computeWindowedSummary, csvPath, sidecarPath } from './captures';
import { startCaptureRun, stopCaptureRun, getPresentMonProcess, captureRunStatus } from './presentmon';
import { getAppConfig } from './app-config';

// A Comparison is a named group of labeled Variants — each Variant is a
// completely normal Capture (same startCaptureRun/stopCaptureRun as a
// standalone capture) written into the comparison's own subfolder instead
// of the flat CAPTURES_DIR. See docs/plans/comparison-captures.md.
export const COMPARISONS_DIR = path.join(CAPTURES_DIR, 'comparisons');

function ensureComparisonsDir(): void {
  try { mkdirSync(COMPARISONS_DIR, { recursive: true }); } catch { /* ignore */ }
}

// Folder name: 20260809-143000_dlss-quality-modes — falls back to the
// process name if no comparison label was given, same shape as captureBaseName.
function comparisonId(processName: string, label?: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const slug = (label?.trim() || processName.replace(/\.exe$/i, '')).replace(/[^\w.-]/g, '_').slice(0, 40);
  return `${ts}_${slug}`;
}

interface ActiveVariant { base: string; label: string; order: number; summary: import('@/types/perf').CaptureRunSummary | null; }

interface ActiveComparison {
  id: string;
  dir: string;
  label: string;
  process: string;
  createdAt: number;
  variants: ActiveVariant[];
  status: 'capturing' | 'paused';
  // Set by finishComparison() while the last variant is still capturing —
  // the in-flight variant's onFinalize hook resolves it once that variant's
  // summary has actually landed in the manifest, so finishing mid-capture
  // can't race the manifest write and silently drop the last variant.
  finishResolve?: () => void;
}

let active: ActiveComparison | null = null;

function manifestPath(dir: string): string { return path.join(dir, 'manifest.json'); }

function saveManifest(): void {
  if (!active) return;
  const manifest: ComparisonManifest = {
    id: active.id, label: active.label, process: active.process, createdAt: active.createdAt,
    variants: active.variants.map(v => ({ base: v.base, label: v.label, order: v.order, summary: v.summary })),
  };
  try { writeFileSync(manifestPath(active.dir), JSON.stringify(manifest)); } catch { /* ignore */ }
}

function startVariant(label?: string, maxDurationS?: number): { ok: boolean; error?: string } {
  if (!active) return { ok: false, error: 'no active comparison' };
  const order = active.variants.length + 1;
  const result = startCaptureRun({
    dir: active.dir,
    maxDurationS,
    onFinalize: (summary) => {
      if (!active) return;
      const v = active.variants.find(vv => vv.order === order);
      if (v) { v.summary = summary; saveManifest(); }
      // A finish was requested while this variant was still capturing —
      // now that its summary is actually saved, complete the finish.
      if (active.finishResolve) { const resolve = active.finishResolve; active = null; resolve(); }
    },
  });
  if (!result.ok || !result.base) return { ok: false, error: result.error ?? 'failed to start variant' };
  active.variants.push({ base: result.base, label: label?.trim() || `Variant ${order}`, order, summary: null });
  active.status = 'capturing';
  saveManifest();
  return { ok: true };
}

export function startComparison(comparisonLabel?: string, firstVariantLabel?: string): { ok: boolean; error?: string } {
  if (active) return { ok: false, error: 'a comparison is already active — finish it first' };
  const process = getPresentMonProcess();
  if (!process) return { ok: false, error: 'no active game to capture — focus a game first' };
  ensureComparisonsDir();
  const id = comparisonId(process, comparisonLabel);
  const dir = path.join(COMPARISONS_DIR, id);
  mkdirSync(dir, { recursive: true });
  active = { id, dir, label: comparisonLabel?.trim() || process, process, createdAt: Date.now(), variants: [], status: 'paused' };
  const result = startVariant(firstVariantLabel);
  if (!result.ok) {
    active = null;
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  return result;
}

// Stops the current variant's capture (same as a normal capture stop) —
// the comparison itself stays open, waiting for CONTINUE or FINISH.
export function pauseComparison(): { ok: boolean; error?: string } {
  if (!active || active.status !== 'capturing') return { ok: false, error: 'no variant currently capturing' };
  stopCaptureRun();
  active.status = 'paused';
  return { ok: true };
}

export function continueComparison(nextLabel?: string, matchFirstDuration?: boolean): { ok: boolean; error?: string } {
  if (!active || active.status !== 'paused') return { ok: false, error: 'comparison is not paused' };
  const maxDurationS = matchFirstDuration ? active.variants[0]?.summary?.durationS ?? undefined : undefined;
  return startVariant(nextLabel, maxDurationS);
}

// Async because finishing mid-capture has to wait for the in-progress
// variant's own finalize (CSV summarized, sidecar written, manifest
// updated) before it's safe to clear `active` — see startVariant's
// onFinalize above.
export function finishComparison(): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!active) return Promise.resolve({ ok: false, error: 'no active comparison' });
  const id = active.id;
  if (active.status === 'paused') {
    active = null;
    return Promise.resolve({ ok: true, id });
  }
  return new Promise(resolve => {
    if (!active) { resolve({ ok: true, id }); return; }
    active.finishResolve = () => resolve({ ok: true, id });
    stopCaptureRun();
  });
}

export function comparisonStatus(): ComparisonRunStatus {
  if (!active) return { active: false };
  const currentVariant = active.variants[active.variants.length - 1];
  const firstVariant = active.variants[0];
  const runStatus = active.status === 'capturing' ? captureRunStatus() : null;
  return {
    active: true,
    id: active.id,
    state: active.status,
    currentVariantLabel: currentVariant?.label,
    currentVariantElapsedS: runStatus?.elapsedS,
    variantsCompleted: active.variants.filter(v => v.summary !== null).length,
    // Lets the "next variant" prompt offer "match Quality Mode's duration
    // (62s)" — only meaningful once the first variant has actually finished.
    firstVariantLabel: firstVariant?.label,
    firstVariantDurationS: firstVariant?.summary?.durationS,
  };
}

export function listComparisons(): ComparisonListItem[] {
  ensureComparisonsDir();
  const out: ComparisonListItem[] = [];
  for (const entry of readdirSync(COMPARISONS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const manifest: ComparisonManifest = JSON.parse(readFileSync(path.join(COMPARISONS_DIR, entry.name, 'manifest.json'), 'utf8'));
      out.push({ id: manifest.id, label: manifest.label, process: manifest.process, createdAt: manifest.createdAt, variantCount: manifest.variants.length });
    } catch { /* skip a corrupt/incomplete comparison folder */ }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

// Only allow a plain directory-name id that actually exists under comparisons/.
function resolveComparisonDir(id: string): string | null {
  if (path.basename(id) !== id) return null;
  const dir = path.join(COMPARISONS_DIR, id);
  return existsSync(manifestPath(dir)) ? dir : null;
}

export function readComparison(id: string): (ComparisonManifest & { variantData: (ReturnType<typeof readCaptureData>)[] }) | null {
  const dir = resolveComparisonDir(id);
  if (!dir) return null;
  let manifest: ComparisonManifest;
  try { manifest = JSON.parse(readFileSync(manifestPath(dir), 'utf8')); } catch { return null; }
  const variantData = manifest.variants.map(v => readCaptureData(`${v.base}.csv`, dir));
  return { ...manifest, variantData };
}

// Builds a Comparison out of captures that already exist in the flat
// CAPTURES_DIR (the plain CAPTURE button, not the live record-variants-in-
// sequence flow) — for "actually, compare these two runs I already took"
// after the fact. No capture engine involvement at all: each item's csv/
// sidecar/sensors.jsonl are copied into a new comparisons/<id>/ folder
// as-is, and its variant summary comes straight from the sidecar that was
// already written when that capture originally finalized — nothing to
// recompute. Validates everything before copying anything, so a bad
// selection fails cleanly with no half-written comparison folder left behind.
export function createComparisonFromCaptures(items: { file: string; label?: string }[], comparisonLabel?: string): { ok: boolean; error?: string; id?: string } {
  if (!Array.isArray(items) || items.length < 2) return { ok: false, error: 'pick at least 2 captures to compare' };

  const resolved: { base: string; label: string; summary: CaptureRunSummary; process: string }[] = [];
  for (const item of items) {
    const file = item.file;
    if (!file || path.basename(file) !== file || !/^[\w.-]+\.csv$/.test(file) || !existsSync(csvPath(file.slice(0, -4)))) {
      return { ok: false, error: `capture not found: ${file}` };
    }
    const base = file.slice(0, -4);
    let sidecar: { process: string; summary: CaptureRunSummary };
    try { sidecar = JSON.parse(readFileSync(sidecarPath(base), 'utf8')); } catch { return { ok: false, error: `corrupt capture data: ${file}` }; }
    resolved.push({ base, label: item.label?.trim() || sidecar.process, summary: sidecar.summary, process: sidecar.process });
  }

  ensureComparisonsDir();
  const id = comparisonId(resolved[0].process, comparisonLabel);
  const dir = path.join(COMPARISONS_DIR, id);
  mkdirSync(dir, { recursive: true });

  const variants: ComparisonVariant[] = resolved.map((r, i) => {
    copyFileSync(csvPath(r.base), csvPath(r.base, dir));
    copyFileSync(sidecarPath(r.base), sidecarPath(r.base, dir));
    const sensorsSrc = path.join(CAPTURES_DIR, `${r.base}.sensors.jsonl`);
    if (existsSync(sensorsSrc)) copyFileSync(sensorsSrc, path.join(dir, `${r.base}.sensors.jsonl`));
    return { base: r.base, label: r.label, order: i + 1, summary: r.summary };
  });

  const manifest: ComparisonManifest = { id, label: comparisonLabel?.trim() || resolved[0].process, process: resolved[0].process, createdAt: Date.now(), variants };
  try { writeFileSync(manifestPath(dir), JSON.stringify(manifest)); } catch { return { ok: false, error: 'failed to save manifest' }; }
  return { ok: true, id };
}

// Sets (or clears, if start/end are both undefined) a variant's region-
// selector window and recomputes+persists its windowed summary. Operates
// directly on the finished comparison's manifest.json rather than `active`
// — regions are a viewer-time adjustment, never set on an in-progress run.
export function setVariantRegion(id: string, variantBase: string, start: number, end: number): { ok: boolean; error?: string; summary?: import('@/types/perf').CaptureRunSummary | null } {
  const dir = resolveComparisonDir(id);
  if (!dir) return { ok: false, error: 'comparison not found' };
  let manifest: ComparisonManifest;
  try { manifest = JSON.parse(readFileSync(manifestPath(dir), 'utf8')); } catch { return { ok: false, error: 'corrupt manifest' }; }
  const variant = manifest.variants.find(v => v.base === variantBase);
  if (!variant) return { ok: false, error: 'variant not found' };
  const summary = computeWindowedSummary(`${variantBase}.csv`, dir, start, end, getAppConfig().hitchThreshold ?? 2);
  if (!summary) return { ok: false, error: 'failed to compute windowed summary — capture file missing?' };
  variant.regionStart = start;
  variant.regionEnd = end;
  variant.windowedSummary = summary;
  try { writeFileSync(manifestPath(dir), JSON.stringify(manifest)); } catch { return { ok: false, error: 'failed to save manifest' }; }
  return { ok: true, summary };
}

export function deleteComparison(id: string): boolean {
  const dir = resolveComparisonDir(id);
  if (!dir) return false;
  try { rmSync(dir, { recursive: true, force: true }); } catch { return false; }
  return true;
}
