import { reorderCpuPriorities } from "@/utils/proces-lasso/process-lasso-config";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';
import z from "zod";

const ReorderBody = z.object({
    order: z.string().array(),
})

export const POST = async(req: NextRequest) => {
    const guard = requireGrant(req, 'processlasso:write');
    if (guard) return guard;

    try {
        const body = ReorderBody.parse(await req.json());
        const updatedConfig = await reorderCpuPriorities(body.order);

        return NextResponse.json({
            ok: true,
            updatedConfig,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to reorder process lasso CPU priorities',
            details: String(err),
        }, { status: 500 });
    }
}
