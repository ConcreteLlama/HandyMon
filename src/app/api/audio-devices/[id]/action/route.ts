import { AudioDeviceActionRequest } from "@/types/audio-devices";
import { IdSegmentParams } from "@/types/segment-params";
import { setDefaultAudioDevice, setVolume } from "@/utils/audio-devices";
import { NextRequest, NextResponse } from "next/server";
import { requireGrant } from '@/utils/grants';

export const POST = async(req: NextRequest, segmentParams: IdSegmentParams) => {
    const guard = requireGrant(req, 'displayoutput:write');
    if (guard) return guard;

    const params = await segmentParams.params;
    const deviceName = params.id;

    const reqBody = await req.json();
    const actionReq = AudioDeviceActionRequest.safeParse(reqBody);
    if (actionReq.error) {
        return NextResponse.json({
            error: actionReq.error,
        }, {
            status: 400,
        })
    }
    const actionBody = actionReq.data;
    for (const action of actionBody.actions) {
        switch (action.action) {
            case 'set-default': {
                for (const type of action.types) {
                    await setDefaultAudioDevice(deviceName, type);
                }
                break;
            }
            case 'set-volume': {
                await setVolume(deviceName, action.volume);
                break;
            }
            default: {
                console.error('Unexected action', action)
            }
        }
    }
    return NextResponse.json({
        ok: true
    })
}