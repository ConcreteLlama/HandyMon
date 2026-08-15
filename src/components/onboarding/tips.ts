import type { SectionId } from '../nav-items';

export interface OnboardingTip {
  id: string;
  section: SectionId;
  version: number; // bump to make this tip reappear for devices that already dismissed an older version
  title: string;
  body: string;
}

// Deliberately a small starting set, not comprehensive coverage of every
// control — proactive/unprompted popups are meant to catch a first-time
// user's attention for the handful of things that most need pointing out,
// not to duplicate the full opt-in help-mode content (helpProps, see
// HelpModeContext.tsx) as unprompted tooltips everywhere. Add more here as
// specific onboarding friction shows up, rather than tagging everything.
export const ONBOARDING_TIPS: OnboardingTip[] = [
  {
    id: 'actions-add',
    section: 'actions',
    version: 1,
    title: 'Build your first Action',
    body: "An Action is a sequence of steps — launch a program, switch display/audio/fan, send a hotkey — triggered in one tap. Tap the + to add your first one.",
  },
  {
    id: 'perf-customize',
    section: 'perf',
    version: 1,
    title: 'This view is yours to arrange',
    body: 'Tap EDIT to reorder or remove cards, or ADD CARD to bring in more stats — nothing here is fixed.',
  },
  {
    id: 'settings-pair',
    section: 'settings',
    version: 1,
    title: 'Control it from your phone too',
    body: 'Settings → Devices has a QR code to pair another device — it gets its own permissions, separate from this one.',
  },
];

// Marks an element as an onboarding-tip target — OnboardingOverlay looks up
// the rest (section/version/title/body) from ONBOARDING_TIPS by id, so this
// is the only thing that needs to live on the actual DOM element.
export function tipProps(id: string) {
  return { 'data-tip-id': id } as const;
}
