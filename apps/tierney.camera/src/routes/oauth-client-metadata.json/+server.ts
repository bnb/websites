import { json } from '@sveltejs/kit';
import { clientMetadata } from '@bnb/atmosphere';
import { SCOPE, SITE_NAME, SITE_URL } from '$lib/site';
import type { RequestHandler } from './$types';

// The OAuth client readers sign in with to like photographs. Its client id is
// this file's own address, which authorization servers fetch it from. (Local
// dev signs in with a loopback client instead, so it never reads this.)
export const GET: RequestHandler = () =>
	json(clientMetadata({ url: SITE_URL, name: SITE_NAME, scope: SCOPE }), {
		headers: { 'cache-control': 'public, max-age=3600' }
	});
