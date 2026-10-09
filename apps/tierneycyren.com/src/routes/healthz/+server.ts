import { healthz } from '@bnb/kit/server';
import type { RequestHandler } from './$types';

// Liveness probe for the host. Doesn't touch the AT Protocol, so a PDS outage
// never restarts the service.
export const GET: RequestHandler = healthz;
