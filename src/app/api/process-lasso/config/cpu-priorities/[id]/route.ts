import { IdSegmentParams } from "@/types/segment-params";
import { removeCpuPriority, setCpuPriority } from "@/utils/proces-lasso/process-lasso-config";
import { CPU_PRIORITY_LEVELS } from "@/utils/proces-lasso/process-lasso";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';
import z from "zod";

const CpuPriorityBody = z.object({
    priority: z.enum(CPU_PRIORITY_LEVELS),
})

export const POST = async(req: NextRequest, segmentParams: IdSegmentParams) => {
    const guard = requireGrant(req, 'processlasso:write');
    if (guard) return guard;

    const params = await segmentParams.params;
    const exe = params.id;

    try {
        if (!exe) {
            throw new Error('Must specify process name');
        }
        const body = CpuPriorityBody.parse(await req.json());
        const updatedConfig = await setCpuPriority(exe, body.priority);

        return NextResponse.json({
            ok: true,
            updatedConfig,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to update process lasso CPU priority',
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
        const updatedConfig = await removeCpuPriority(exe);

        return NextResponse.json({
            ok: true,
            updatedConfig,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to delete CPU priority',
            details: String(err),
        }, { status: 500 });
    }
}
