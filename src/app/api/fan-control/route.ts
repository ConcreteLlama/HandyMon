import { FancontrolGetResponse } from "@/types/fan-control";
import { getActiveFanProfile, listFanProfiles } from "@/utils/fan-control";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';

export const GET = async(req: NextRequest) => {
    const guard = requireGrant(req, 'fans:read');
    if (guard) return guard;
    try {
        const activeProfile = await getActiveFanProfile();
        const availableProfiles = await listFanProfiles();
        const response: FancontrolGetResponse = {
            available: true,
            activeProfile,
            availableProfiles,
        }
        return NextResponse.json(response);
    } catch {
        // Not installed at the configured path, or never run yet (no CACHE
        // file/config directory) — not an error state to retry, just "not
        // set up" for the UI to say so instead of spinning forever.
        const response: FancontrolGetResponse = {
            available: false,
            activeProfile: '',
            availableProfiles: [],
        }
        return NextResponse.json(response);
    }
}