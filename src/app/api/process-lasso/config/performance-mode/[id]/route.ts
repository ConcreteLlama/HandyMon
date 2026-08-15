import { IdSegmentParams } from "@/types/segment-params";
import { setPerformanceModeInduce } from "@/utils/proces-lasso/process-lasso-config";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';

export const POST = async(req: NextRequest, segmentParams: IdSegmentParams) => {
    const guard = requireGrant(req, 'processlasso:write');
    if (guard) return guard;

    const params = await segmentParams.params;
    const exe = params.id;

    try {
        if (!exe) {
            throw new Error('Must specify process name');
        }
        const updatedConfig = await setPerformanceModeInduce(exe, true);

        return NextResponse.json({
            ok: true,
            updatedConfig,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to enable induce performance mode',
            details: String(err),
        }, { status: 500 });
    }
}

export const DELETE = async(req: NextRequest, segmentParams: IdSegmentParams) => {
    const guard = requireGrant(req, 'processlasso:write');
    if (guard) return guard;

    const params = await segmentParams.params;
    const exe = params.id;

    try {
        if (!exe) {
            throw new Error('Must specify process name');
        }
        const updatedConfig = await setPerformanceModeInduce(exe, false);

        return NextResponse.json({
            ok: true,
            updatedConfig,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to disable induce performance mode',
            details: String(err),
        }, { status: 500 });
    }
}
