import type { Row } from './components/PostTable.svelte';
import { htmlDate, year } from './dates';
import { pad2 } from './format';
import { SERIES } from './series';
import type { Post } from './server/posts';
import { seriesTotal } from './server/posts';
import { renderInline } from './server/markdown';

/** The index: newest first, numbered so the newest post has the highest number. */
export function indexRows(posts: readonly Post[]): Row[] {
	return posts.toReversed().map((post, i) => ({
		n: pad2(posts.length - i),
		title: renderInline(post.title),
		url: post.url,
		series: post.series
			? {
					label: `${SERIES[post.series].title} ${post.part}/${seriesTotal(posts, post.series)}`,
					url: `/series/${post.series}/`
				}
			: undefined,
		topic: post.topic,
		date: htmlDate(post.date),
		year: year(post.date)
	}));
}
