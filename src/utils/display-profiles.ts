import { getAppConfig, writeAppConfig } from './app-config';
import { applyDisplayConfig, captureDisplayConfig, describeDisplayConfig, ERROR_BAD_CONFIGURATION, fingerprintDisplayConfig, getDisplayDetails, NativeDisplayDetail } from './native-display';
import { toKebabId } from './id';
import { log } from './logger';
import type { DisplayProfileConfig } from '@/types/app-config';

export const listDisplayProfiles = (): DisplayProfileConfig[] => getAppConfig().displayProfiles;

// DISPLAYCONFIG_VIDEO_OUTPUT_TECHNOLOGY values worth naming — anything else
// falls back to a raw numeric label rather than guessing.
const OUTPUT_TECHNOLOGY_NAMES: Record<number, string> = {
  0: 'VGA',
  1: 'S-Video',
  2: 'Composite Video',
  3: 'Component Video',
  4: 'DVI',
  5: 'HDMI',
  6: 'LVDS',
  8: 'D-Jpn',
  9: 'SDI',
  10: 'DisplayPort',
  11: 'DisplayPort (embedded)',
  12: 'UDI',
  13: 'UDI (embedded)',
  14: 'SDTV Dongle',
  2147483648: 'Internal',
};

export interface DisplayDetail {
  targetId: number;
  name: string;
  connection: string;
  width: number;
  height: number;
  refreshRate: number;
  rotation: string;
  hdrSupported: boolean;
  hdrEnabled: boolean;
  bitsPerColorChannel: number;
}

const ROTATION_NAMES: Record<number, string> = { 1: 'Landscape', 2: 'Portrait (90°)', 3: 'Landscape (flipped)', 4: 'Portrait (270°)' };

const toDisplayDetail = (d: NativeDisplayDetail): DisplayDetail => ({
  targetId: d.TargetId,
  name: d.FriendlyName?.trim() || 'Unknown display',
  connection: OUTPUT_TECHNOLOGY_NAMES[d.OutputTechnology] ?? `Unknown (${d.OutputTechnology})`,
  width: d.Width,
  height: d.Height,
  refreshRate: d.RefreshRate,
  rotation: ROTATION_NAMES[d.Rotation] ?? 'Unknown',
  hdrSupported: d.HdrSupported,
  hdrEnabled: d.HdrEnabled,
  bitsPerColorChannel: d.BitsPerColorChannel,
});

export const listLiveDisplayDetails = async (): Promise<DisplayDetail[]> => {
  const raw = await getDisplayDetails();
  return raw.map(toDisplayDetail);
};

// Describes what a SAVED profile contains (friendly name/HDR/resolution),
// decoded from its own stored data — not a live query, so this works even
// when the profile isn't the currently active layout.
export const describeDisplayProfile = async (id: string): Promise<DisplayDetail[] | null> => {
  const profile = getAppConfig().displayProfiles.find(p => p.id === id);
  if (!profile) return null;
  const raw = await describeDisplayConfig({ json: profile.json });
  return raw.map(toDisplayDetail);
};

// Captures the current live monitor layout and saves it as a new named
// profile — there's no way to hand-author one, only capture-then-reapply
// (same workflow MonitorSwitcher itself used). excludeTargetIds drops
// specific currently-active displays from what gets saved (e.g. an AVR
// passthrough reporting a phantom display the user never intended to
// include) — the caller is expected to have offered a device picker.
export const captureDisplayProfile = async (label: string, excludeTargetIds: number[] = []): Promise<DisplayProfileConfig> => {
  const { json } = await captureDisplayConfig(excludeTargetIds);
  const fingerprint = await fingerprintDisplayConfig({ json });
  const config = getAppConfig();
  const id = toKebabId(label) || `display-${Date.now()}`;
  const profile: DisplayProfileConfig = { id, label, json, fingerprint };
  writeAppConfig({ ...config, displayProfiles: [...config.displayProfiles, profile] });
  return profile;
};

// Re-captures the current live layout into an *existing* profile (same id,
// label, and position in the list) — the "update with current setup" action,
// for when a saved layout needs refreshing rather than creating a new one.
export const updateDisplayProfile = async (id: string, excludeTargetIds: number[] = []): Promise<DisplayProfileConfig | null> => {
  const config = getAppConfig();
  const existing = config.displayProfiles.find(p => p.id === id);
  if (!existing) return null;

  const { json } = await captureDisplayConfig(excludeTargetIds);
  const fingerprint = await fingerprintDisplayConfig({ json });
  const updated: DisplayProfileConfig = { ...existing, json, fingerprint };
  writeAppConfig({ ...config, displayProfiles: config.displayProfiles.map(p => p.id === id ? updated : p) });
  return updated;
};

export const deleteDisplayProfile = (id: string): void => {
  const config = getAppConfig();
  writeAppConfig({ ...config, displayProfiles: config.displayProfiles.filter(p => p.id !== id) });
};

// Renames a profile in place — id (and everything else) stays untouched,
// since switching/active-detection key off id/fingerprint, not label.
export const renameDisplayProfile = (id: string, label: string): DisplayProfileConfig | null => {
  const config = getAppConfig();
  const existing = config.displayProfiles.find(p => p.id === id);
  if (!existing) return null;
  const updated: DisplayProfileConfig = { ...existing, label };
  writeAppConfig({ ...config, displayProfiles: config.displayProfiles.map(p => p.id === id ? updated : p) });
  return updated;
};

// Reorders the whole list to match orderedIds (drag-and-drop reorder, one
// call per drop rather than a single-step up/down). Any profile not present
// in orderedIds is kept, appended at the end, rather than silently dropped —
// shouldn't happen from the UI, but avoids data loss if it ever does.
export const reorderDisplayProfiles = (orderedIds: string[]): DisplayProfileConfig[] => {
  const config = getAppConfig();
  const byId = new Map(config.displayProfiles.map(p => [p.id, p]));
  const reordered = orderedIds.map(id => byId.get(id)).filter((p): p is DisplayProfileConfig => !!p);
  const includedIds = new Set(reordered.map(p => p.id));
  const missing = config.displayProfiles.filter(p => !includedIds.has(p.id));
  const next = [...reordered, ...missing];
  writeAppConfig({ ...config, displayProfiles: next });
  return next;
};

// Captures the live layout fresh and finds the saved profile that best
// matches it. This is a subset match, not exact equality: a profile is
// considered active if everything IT cares about is present and correctly
// configured live, regardless of what else happens to be active (e.g. a
// phantom AVR-passthrough target a profile deliberately excluded at capture
// time shouldn't block a match against it). When more than one profile
// qualifies — e.g. a single-display profile whose one display is also part
// of a larger active layout — the most complete match wins.
// Profiles saved before fingerprints existed (fingerprint undefined) never
// match until re-captured/updated.
export const getActiveDisplayProfileId = async (): Promise<string | null> => {
  const { json } = await captureDisplayConfig();
  const liveFingerprint = await fingerprintDisplayConfig({ json });
  const liveParts = new Set(liveFingerprint.split('|').filter(Boolean));

  let best: DisplayProfileConfig | null = null;
  let bestSize = 0;
  for (const p of getAppConfig().displayProfiles) {
    if (!p.fingerprint) continue;
    const parts = p.fingerprint.split('|').filter(Boolean);
    if (parts.length === 0) continue;
    if (parts.length > bestSize && parts.every(part => liveParts.has(part))) {
      best = p;
      bestSize = parts.length;
    }
  }
  return best?.id ?? null;
};

export interface SetDisplayProfileResult {
  ok: boolean;
  message: string;
  // True when the failure was specifically ERROR_BAD_CONFIGURATION and this
  // attempt didn't already allow changes — i.e. retrying with allowChanges
  // might succeed. Not set for other failures (retrying wouldn't help).
  canRetryWithChanges?: boolean;
}

// profileId references a DisplayProfileConfig.id (was a MonitorSwitcher XML
// filename before the native replacement — Mode configs already just store
// an opaque string id, so no migration needed on that side).
//
// allowChanges lets Windows tweak minor mode details (e.g. exact refresh
// timing) if the captured config can't be applied byte-exact anymore —
// tried without it first since that's more faithful to what was saved;
// callers should only pass allowChanges: true as an explicit user-confirmed
// retry after a first attempt fails with canRetryWithChanges.
export const setDisplayProfile = async (profileId: string, allowChanges = false): Promise<SetDisplayProfileResult> => {
  if (!profileId) {
    return { ok: false, message: 'No display profile specified' };
  }

  const profile = getAppConfig().displayProfiles.find(p => p.id === profileId);
  if (!profile) {
    return { ok: false, message: `Display profile "${profileId}" not found` };
  }

  const result = await applyDisplayConfig({ json: profile.json }, allowChanges);
  if (result.ok) {
    log.info('Applied display profile', { profileId, label: profile.label, allowChanges });
    return { ok: true, message: `Switched to ${profile.label}` };
  }

  // SetDisplayConfig returning a non-zero result is a clean failure, not a
  // thrown exception — nothing else logs this, so it has to happen here or
  // it's invisible (this was the actual gap behind a report of "logs show
  // nothing useful" for a failed apply).
  log.error('SetDisplayConfig failed', { profileId, label: profile.label, allowChanges, hresult: result.hresult });
  return {
    ok: false,
    message: `Apply failed (error ${result.hresult})`,
    canRetryWithChanges: !allowChanges && result.hresult === ERROR_BAD_CONFIGURATION,
  };
};
