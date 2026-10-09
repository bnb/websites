import { PUBLICATION } from '$lib/server/standard-site';

// lets readers verify that the site and the publication belong together
export const prerender = true;

export const GET = () =>
	new Response(PUBLICATION.uri, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
