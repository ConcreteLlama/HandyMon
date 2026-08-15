import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig, writeAppConfig } from '@/utils/app-config';
import { AppConfig, AppConfigSchema } from '@/types/app-config';
import { isLocalhostRequest } from '@/utils/request-utils';
import { requireGrant, hasGrant } from '@/utils/grants';

// Fields a remote device may change on an existing action
const ACTION_DISPLAY_KEYS = ['name', 'favourite', 'groupId', 'icon'] as const;

function sanitizeForRemote(current: AppConfig, incoming: AppConfig, canEditThemes: boolean): AppConfig {
  // Only update display fields on existing actions — no additions, no deletions,
  // no changes to type / program / args / keys / steps
  const actions = current.actions.map(existing => {
    const updated = incoming.actions.find(a => a.id === existing.id);
    if (!updated) return existing;
    return {
      ...existing,
      ...Object.fromEntries(
        ACTION_DISPLAY_KEYS
          .filter(k => k in updated)
          .map(k => [k, (updated as any)[k]])
      ),
    };
  });

  return {
    // Tool paths are localhost-only — keep current values
    logLevel:                   current.logLevel,
    port:                       current.port,
    rtssInstallPath:            current.rtssInstallPath,
    fanControlPath:             current.fanControlPath,
    processLassoConfigPath:     current.processLassoConfigPath,
    lhmPort:                    current.lhmPort,
    presentMonPath:             current.presentMonPath,
    bundledLhm:                 current.bundledLhm,
    bundledPresentMon:          current.bundledPresentMon,
    // Which services exist / are controllable is an admin decision — a remote
    // device shouldn't be able to grant itself new capabilities by editing this.
    services:                   current.services,
    // These are fine to change from any authenticated device
    fpsPollMs:              incoming.fpsPollMs,
    fpsWindowMs:            incoming.fpsWindowMs,
    fpsGraphSeconds:        incoming.fpsGraphSeconds,
    hitchThreshold:         incoming.hitchThreshold,
    processExclusions:      incoming.processExclusions,
    configuredAudioDevices: incoming.configuredAudioDevices,
    actionGroups:           incoming.actionGroups,
    actionPages:            incoming.actionPages,
    actions,
    processRulePresets:     incoming.processRulePresets,
    // Custom theme definitions are shared config (every paired device can
    // select them), but creating/editing/deleting one needs its own grant,
    // separate from the general settings:write this whole endpoint already
    // requires — a device without it can still submit other config changes,
    // it just can't touch this field.
    customThemes:           canEditThemes ? incoming.customThemes : current.customThemes,
    displayProfiles:        incoming.displayProfiles,
    navOrder:               incoming.navOrder,
  };
}

export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'settings:read');
  if (guard) return guard;
  return NextResponse.json(getAppConfig());
}

export async function PUT(req: NextRequest) {
  const guard = requireGrant(req, 'settings:write');
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = AppConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid config', details: parsed.error.flatten() }, { status: 400 });
  }

  const config = isLocalhostRequest(req)
    ? parsed.data
    : sanitizeForRemote(getAppConfig(), parsed.data, hasGrant(req.headers.get('x-device-id'), 'appearance:write'));

  writeAppConfig(config);
  return NextResponse.json({ success: true });
}
