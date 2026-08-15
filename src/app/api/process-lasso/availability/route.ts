import { processLassoAvailable } from "@/utils/proces-lasso/process-lasso-config";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';
import os from 'os';

export const GET = async(req: NextRequest) => {
    const guard = requireGrant(req, 'processlasso:read');
    if (guard) return guard;
    return NextResponse.json({ available: processLassoAvailable(), coreCount: os.cpus().length });
}
