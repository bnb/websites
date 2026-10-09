import { error } from '@sveltejs/kit';
import { findPost, loadPosts } from '$lib/server/posts';
import { socialImage } from '$lib/server/social';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => loadPosts().map(({ slug }) => ({ slug }));

export const GET: RequestHandler = async ({ params }) => {
	const post = findPost(params.slug);
	if (!post) error(404, 'Not found');
	return new Response(await socialImage(post), { headers: { 'content-type': 'image/png' } });
};
