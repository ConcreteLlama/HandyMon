import { z } from 'zod';

// tipId -> last-acknowledged version. Host-only feature (see
// OnboardingOverlay's useIsLocalhost gate) — config/setup happens on the
// host, so there's only ever one relevant audience, no per-device tracking
// needed. A tip is "seen" once dismissed[tipId] >= that tip's current
// version — bumping a tip's version (see the registry in
// src/components/onboarding/tips.ts) makes it reappear, without needing to
// track dismissal history.
export const OnboardingDismissalsSchema = z.record(z.string(), z.number());
export type OnboardingDismissals = z.infer<typeof OnboardingDismissalsSchema>;
