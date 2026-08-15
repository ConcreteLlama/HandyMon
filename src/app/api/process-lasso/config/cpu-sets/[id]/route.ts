import { IdSegmentParams } from "@/types/segment-params";
import { removeCpuSet, setCpuSet } from "@/utils/proces-lasso/process-lasso-config";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';
import z from "zod";

const CpuSetCores = z.object({
    cores: z.number().array(),
})

export const POST = async(req: NextRequest, segmentParams: IdSegmentParams) => {
    const guard = requireGrant(req, 'processlasso:write');
    if (guard) return guard;

    const params = await segmentParams.params;
    const cpuSetName = params.id;

    try {
        if (!cpuSetName) {
            throw new Error('Must specify cpu set name');
        } 
        const config = CpuSetCores.parse(await req.json());
        const updatedConfig = await setCpuSet(cpuSetName, config.cores);

        return NextResponse.json({
            ok: true,
            updatedConfig,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to update process lasso config',
            details: String(err),
        }, { status: 500 });
    }
}

export const DELETE = async(req: NextRequest, segmentParams: IdSegmentParams) => {
    const guard = requireGrant(req, 'processlasso:write');
    if (guard) return guard;

    const params = await segmentParams.params;
    const cpuSetName = params.id;

    try {
        if (!cpuSetName) {
            throw new Error('Must specify cpu set name');
        } 
        const updatedConfig = await removeCpuSet(cpuSetName);

        return NextResponse.json({
            ok: true,
            updatedConfig,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to delete cpu set',
            details: String(err),
        }, { status: 500 });
    }
}