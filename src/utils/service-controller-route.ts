import { NextRequest, NextResponse } from 'next/server';
import { ServiceController } from './service';

type ServiceGetResponseBase = {
    running: boolean;
}
export type ServiceControllerRouteOpts = {
    GET?: {
        beforeReturn?: (response: ServiceGetResponseBase) => any;
    },
}
export const makeServiceControllerRoutes = (serviceController: ServiceController, opts: ServiceControllerRouteOpts = {}) => ({
    POST: async (req: Request): Promise<NextResponse> => {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action');

        if (action !== 'start' && action !== 'stop' && action !== 'restart') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const command = action === 'start' ? () => serviceController.start(10000) : action === 'stop' ? () => serviceController.stop(10000) : serviceController.restart;

        try {
            const result = await command();
            return NextResponse.json({
                ok: true,
                action,
                message: result,
            }
            )
        } catch (e: any) {
            return NextResponse.json({
                ok: false,
                action,
                error: e,
                message: e.message || e,
            }, {
                status: 500,
            });
        }
    },
    GET: async (req: NextRequest) => {
        const running = await serviceController.isRunning();
        const beforeReturnHook = opts.GET?.beforeReturn;
        let response: ServiceGetResponseBase = {
            running,
        }
        if (beforeReturnHook) {
            response = await beforeReturnHook(response);
        }
        return NextResponse.json(response);
    }
})
