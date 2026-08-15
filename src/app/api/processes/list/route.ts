import { listRunningProcesses } from "@/utils/processes";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';

export const GET = async(req: NextRequest) => {
    const guard = requireGrant(req, 'processes:read');
    if (guard) return guard;
    const processes = await listRunningProcesses();
    return NextResponse.json({
        processes,
    })
}