import { error } from '@sveltejs/kit';
import { clientFile, clientFiles } from '$lib/server/subscribe-client';
import type { EntryGenerator, RequestHandler } from './$types';

// The subscribe button's script (and the OAuth client it loads on click),
// built by @bnb/standard-site and written out as static files.
export const prerender = true;

export const entries: EntryGenerator = () => clientFiles().map((file) => ({ file }));

export const GET: RequestHandler = ({ params }) => {
	const body = clientFile(params.file);
	if (!body) error(404, 'Not found');
	return new Response(body, { headers: { 'content-type': 'text/javascript; charset=utf-8' } });
};
