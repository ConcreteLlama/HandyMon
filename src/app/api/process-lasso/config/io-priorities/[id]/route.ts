import { IdSegmentParams } from "@/types/segment-params";
import { removeIoPriority, setIoPriority } from "@/utils/proces-lasso/process-lasso-config";
import { IO_PRIORITY_LEVELS } from "@/utils/proces-lasso/process-lasso";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';
import z from "zod";

const IoPriorityBody = z.object({
    priority: z.union(IO_PRIORITY_LEVELS.map(n => z.literal(n)) as [z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]),
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
        const body = IoPriorityBody.parse(await req.json());
        const updatedConfig = await setIoPriority(exe, body.priority);

        return NextResponse.json({
            ok: true,
            updatedConfig,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to update process lasso IO priority',
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
        const updatedConfig = await removeIoPriority(exe);

        return NextResponse.json({
            ok: true,
            updatedConfig,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to delete IO priority',
            details: String(err),
        }, { status: 500 });
    }
}
