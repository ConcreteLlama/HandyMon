import { PartialRtssConfigSchema, RtssConfigSchema } from '@/types/rtss';
import { IdSegmentParams } from '@/types/segment-params';
import { getRtssConfig, getRtssLimit, patchRtssConfig, setRtssConfig, setRtssLimit } from '@/utils/rtss';
import { NextRequest, NextResponse } from 'next/server';
import { requireGrant } from '@/utils/grants';

export const POST = async(req: NextRequest, segmentParams: IdSegmentParams) => {
    const guard = requireGrant(req, 'gaming:write');
    if (guard) return guard;

    const params = await segmentParams.params;
    const profileId = params.id;

    try {
        if (!profileId) {
            throw new Error('Must specify profile id');
        }
        const config = RtssConfigSchema.parse(await req.json());
        await setRtssConfig(profileId, config);

        return NextResponse.json({
            ok: true,
            config,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to update RTSS config',
            details: String(err),
        }, { status: 500 });
    }
}

export const PATCH = async(req: NextRequest, segmentParams: IdSegmentParams) => {
    const guard = requireGrant(req, 'gaming:write');
    if (guard) return guard;

    const params = await segmentParams.params;
    const profileId = params.id;

    try {
        if (!profileId) {
            throw new Error('Must specify profile id');
        }
        const config = PartialRtssConfigSchema.parse(await req.json());
        const updatedConfig = await patchRtssConfig(profileId, config);

        return NextResponse.json({
            ok: true,
            updatedConfig,
        });
    } catch (err) {
        return NextResponse.json({
            ok: false,
            error: 'Failed to update RTSS config',
            details: String(err),
        }, { status: 500 });
    }
}


export const GET = async (req: NextRequest, segmentParams: IdSegmentParams) => {
    const guard = requireGrant(req, 'gaming:read');
    if (guard) return guard;

    const params = await segmentParams.params;
    const profileId = params.id;
    const config = await getRtssConfig(profileId);
    return NextResponse.json({
        config,
    })
}