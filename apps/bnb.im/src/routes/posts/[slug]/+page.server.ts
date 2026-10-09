import { error } from '@sveltejs/kit';
import { dotDate, htmlDate } from '$lib/dates';
import { displayTags, readingTime } from '$lib/format';
import { SERIES } from '$lib/series';
import { embedBlueskyPosts } from '$lib/server/bluesky';
import { renderInline } from '$lib/server/markdown';
import { loadPosts, seriesTotal } from '$lib/server/posts';
import {
	DISCUSSION_PATH,
	PUBLICATION,
	SCRIPT_PATH,
	documentUris,
	headTags
} from '$lib/server/standard-site';
import { HIDDEN_COMMENTS } from '$lib/site';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => loadPosts().map(({ slug }) => ({ slug }));

export const load: PageServerLoad = async ({ params }) => {
	const posts = loadPosts();
	const post = posts.find(({ slug }) => slug === params.slug);
	if (!post) error(404, 'Not found');

	const uri = documentUris(posts).get(post.slug)?.uri;
	return {
		slug: post.slug,
		url: post.url,
		title: post.title,
		titleHtml: renderInline(post.title),
		description: post.description,
		date: htmlDate(post.date),
		dotDate: dotDate(post.date),
		readingTime: readingTime(post.html),
		topic: post.topic,
		series: post.series
			? {
					label: `${SERIES[post.series].title} ${post.part}/${seriesTotal(posts, post.series)}`,
					url: `/series/${post.series}/`
				}
			: undefined,
		tags: displayTags(post.tags),
		html: await embedBlueskyPosts(post.html),
		postTags: uri ? headTags(uri).slice(1) : [],
		subscribe: { publication: PUBLICATION.uri, script: SCRIPT_PATH },
		// upvotes and comments are on the post's record, so a draft (no record) has neither
		discussion: uri
			? { subject: uri, script: DISCUSSION_PATH, hide: HIDDEN_COMMENTS.join(' ') }
			: null
	};
};
