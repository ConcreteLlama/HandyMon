import { rtssAvailable } from "@/utils/rtss";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';

export const GET = async(req: NextRequest) => {
    const guard = requireGrant(req, 'gaming:read');
    if (guard) return guard;
    return NextResponse.json({ available: rtssAvailable() });
}
