import { getProcessLassoConfig } from "@/utils/proces-lasso/process-lasso-config";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';

export const GET = async(req: NextRequest) => {
    const guard = requireGrant(req, 'processlasso:read');
    if (guard) return guard;
    const processLassoConfig = await getProcessLassoConfig();
    return NextResponse.json(processLassoConfig)
}
