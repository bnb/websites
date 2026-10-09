import { callbackPage } from '$lib/server/standard-site';

// where readers land after signing in to subscribe
export const prerender = true;

// In `vite dev`, hooks.ts reroutes /oauth/callback/ here; an endpoint's default
// ('never') would then redirect to /oauth/callback, which nothing serves.
export const trailingSlash = 'ignore';

export const GET = () =>
	new Response(callbackPage(), { headers: { 'content-type': 'text/html; charset=utf-8' } });
