import fs from 'fs';
import path from 'path';
import { CONFIG_DIR } from './dirs';
import { OnboardingDismissals, OnboardingDismissalsSchema } from '@/types/onboarding';

const ONBOARDING_FILE = path.join(CONFIG_DIR, 'onboarding.json');

// Same BOM-tolerance reasoning as devices.ts/app-config.ts: a stray BOM
// shouldn't be indistinguishable from "file doesn't exist yet" and silently
// wipe dismissal state.
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

export function getDismissed(): OnboardingDismissals {
  try {
    const raw = JSON.parse(stripBom(fs.readFileSync(ONBOARDING_FILE, 'utf-8')));
    const parsed = OnboardingDismissalsSchema.safeParse(raw);
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

// versions: tipId -> version being acknowledged. One call handles all three
// dismiss scopes (single tip / whole section / everything) — the caller
// (the client, which owns the tip registry) just decides how many entries
// to include.
export function dismissTips(versions: Record<string, number>): void {
  const merged = { ...getDismissed(), ...versions };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = ONBOARDING_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2));
  fs.renameSync(tmp, ONBOARDING_FILE);
}
