import { listRunningProcesses } from "@/utils/processes";
import { getActiveRtssProfile, listRtssProfiles } from "@/utils/rtss";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';

export const GET = async(req: NextRequest) => {
    const guard = requireGrant(req, 'gaming:read');
    if (guard) return guard;

    const profiles = await listRtssProfiles();
    const activeProfile = await getActiveRtssProfile(profiles);
    return NextResponse.json({
        profiles,
        activeProfile,
    })
}