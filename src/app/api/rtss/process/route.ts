import { NextRequest } from 'next/server';
import { RtssService } from '@/utils/rtss';
import { makeServiceControllerRoutes } from '@/utils/service-controller-route';
import { requireGrant } from '@/utils/grants';

const serviceControllerRoutes = makeServiceControllerRoutes(RtssService);

export const POST = async (req: NextRequest) => {
  const guard = requireGrant(req, 'gaming:write');
  if (guard) return guard;
  return serviceControllerRoutes.POST(req);
};
export const GET = async (req: NextRequest) => {
  const guard = requireGrant(req, 'gaming:read');
  if (guard) return guard;
  return serviceControllerRoutes.GET(req);
};

