/**
 * Liveness probe for the host (e.g. Railway's healthcheck path). Deliberately
 * touches nothing upstream, so an AT Protocol outage never restarts a service.
 */
export const healthz = (): Response =>
	new Response('ok', { headers: { 'cache-control': 'no-store', 'content-type': 'text/plain' } });
