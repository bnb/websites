import { atomFeed } from '$lib/server/feed';
import { loadPosts } from '$lib/server/posts';

export const prerender = true;

export function GET() {
	return new Response(atomFeed(loadPosts()), {
		headers: { 'content-type': 'application/atom+xml; charset=utf-8' }
	});
}
