import { IdSegmentParams } from "@/types/segment-params";
import { setFanProfile } from "@/utils/fan-control";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';

export const POST = async (req: NextRequest, segmentParams: IdSegmentParams) => {
    const guard = requireGrant(req, 'fans:write');
    if (guard) return guard;

    const params = await segmentParams.params;
    const id = params.id;
    if (!id) {
        return NextResponse.json({
            message: "Must specify profile to activate",
        })
    }
    try {
        await setFanProfile(id);
        return NextResponse.json({
            ok: true,
        })
    } catch (e: any) {
        return NextResponse.json({
            message: e.message,
            error: e,
        })
    }

}