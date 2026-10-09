import { describe, expect, it } from 'vitest';
import { indexRows } from './rows';
import type { Post } from './server/posts';
import { loadPosts } from './server/posts';

function post(slug: string, date: string, extra: Partial<Post> = {}): Post {
	return {
		slug,
		file: `/posts/${slug}.md`,
		url: `/posts/${slug}/`,
		title: slug,
		date: new Date(date),
		tags: ['post'],
		draft: false,
		source: '',
		html: '',
		...extra
	};
}

describe('indexRows', () => {
	const posts = [
		post('explicit', '2021-06-16', {
			title: 'Explicit ESM in Node.js with .mjs',
			topic: 'Node.js',
			series: 'esm-in-node-js',
			part: '1'
		}),
		post('implicit', '2021-06-16', {
			title: 'Implicit ESM in Node.js',
			topic: 'Node.js',
			series: 'esm-in-node-js',
			part: '2'
		}),
		post('jest', '2022-04-09', { title: 'Jest and the `--changedSince` flag', topic: 'Jest' })
	];

	it('lists the newest post first, numbered highest', () => {
		const rows = indexRows(posts);
		expect(rows.map((row) => [row.n, row.url])).toEqual([
			['03', '/posts/jest/'],
			['02', '/posts/implicit/'],
			['01', '/posts/explicit/']
		]);
		// the posts themselves stay oldest first
		expect(posts[0].slug).toBe('explicit');
	});

	it('renders inline Markdown in titles, with the topic, date and year', () => {
		expect(indexRows(posts)[0]).toEqual({
			n: '03',
			title: 'Jest and the <code>--changedSince</code> flag',
			url: '/posts/jest/',
			series: undefined,
			topic: 'Jest',
			date: '2022-04-09',
			year: '2022'
		});
	});

	it('labels series posts with their part and links the series', () => {
		const [, implicit, explicit] = indexRows(posts);
		expect(implicit.series).toEqual({
			label: 'ESM in Node.js 2/2',
			url: '/series/esm-in-node-js/'
		});
		expect(explicit.series).toEqual({
			label: 'ESM in Node.js 1/2',
			url: '/series/esm-in-node-js/'
		});
	});

	it('is empty without posts', () => {
		expect(indexRows([])).toEqual([]);
	});

	it('numbers the real index', () => {
		const rows = indexRows(loadPosts());
		expect(rows).toHaveLength(14);
		expect(rows[0]).toMatchObject({ n: '14', url: '/posts/what-is-the-atmosphere/', year: '2026' });
		expect(rows.at(-1)).toMatchObject({
			n: '01',
			url: '/posts/my-first-experience-attending-tc39/'
		});
		expect(
			rows.find((row) => row.url === '/posts/implicit-esm-in-node-js-with-type-module/')
		).toMatchObject({
			title: 'Implicit ESM in Node.js with &quot;type&quot;: &quot;module&quot;',
			series: { label: 'ESM in Node.js 2/3', url: '/series/esm-in-node-js/' },
			topic: 'Node.js'
		});
	});
});
