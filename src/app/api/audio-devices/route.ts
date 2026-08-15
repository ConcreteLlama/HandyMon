import { listAudioDevices } from "@/utils/audio-devices";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';

export const GET = async(request: NextRequest): Promise<Response> => {
    const guard = requireGrant(request, 'displayoutput:read');
    if (guard) return guard;

    const devices = await listAudioDevices();
    return NextResponse.json({
        devices,
    })
};