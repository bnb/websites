import { error } from '@sveltejs/kit';
import { htmlDate, year } from '$lib/dates';
import { pad2 } from '$lib/format';
import { renderInline } from '$lib/server/markdown';
import { collectSeries, loadPosts } from '$lib/server/posts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () =>
	collectSeries(loadPosts()).map(({ slug }) => ({ slug }));

export const load: PageServerLoad = ({ params }) => {
	const series = collectSeries(loadPosts()).find(({ slug }) => slug === params.slug);
	if (!series) error(404, 'Not found');
	return {
		title: series.title,
		description: series.description,
		rows: series.posts.map((post) => ({
			n: pad2(post.part ?? ''),
			title: renderInline(post.title),
			url: post.url,
			date: htmlDate(post.date),
			year: year(post.date)
		}))
	};
};
