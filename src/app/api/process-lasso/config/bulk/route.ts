import { bulkSetProcessRules } from "@/utils/proces-lasso/process-lasso-config";
import { IO_PRIORITY_LEVELS, CPU_PRIORITY_LEVELS } from "@/utils/proces-lasso/process-lasso";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';
import z from "zod";

// cores/priority/cpuPriority accept null alongside a value — omitted (undefined)
// means "leave untouched", null means "explicitly clear" (see bulkSetProcessRules).
const BulkBody = z.object({
    exes: z.string().array().min(1),
    cores: z.number().array().nullable().optional(),
    priority: z.union([...IO_PRIORITY_LEVELS.map(n => z.literal(n)), z.null()] as [z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodNull]).optional(),
    cpuPriority: z.enum(CPU_PRIORITY_LEVELS).nullable().optional(),
    performanceMode: z.boolean().optional(),
})

export const POST = async(req: NextRequest) => {
    const guard = requireGrant(req, 'processlasso:write');
    if (guard) return guard;

    try {
        const body = BulkBody.parse(await req.json());
        if (body.cores === undefined && body.priority === undefined && body.cpuPriority === undefined && body.performanceMode === undefined) {
            throw new Error('Must specify cores, priority, cpuPriority, and/or performanceMode to apply');
        }
        const updatedConfig = await bulkSetProcessRules(body.exes, { cores: body.cores, priority: body.priority, cpuPriority: body.cpuPriority, performanceMode: body.performanceMode });

        return NextResponse.json({
            ok: true,
            updatedConfig,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to bulk-update process lasso rules',
            details: String(err),
        }, { status: 500 });
    }
}
