import { clientMetadata } from '$lib/server/standard-site';

// the OAuth client the subscribe button signs readers in with
export const prerender = true;

export const GET = () =>
	new Response(`${JSON.stringify(clientMetadata(), null, 2)}\n`, {
		headers: { 'content-type': 'application/json' }
	});
