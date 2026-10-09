import { describe, expect, it } from 'vitest';
import type { Post } from './posts';
import {
	EXCERPT_SEPARATOR,
	collectSeries,
	findPost,
	loadPosts,
	parsePost,
	parsePosts,
	seriesTotal,
	sortPosts,
	topics
} from './posts';

const doc = (frontMatter: string, body = 'Hello.\n') => `---\n${frontMatter}\n---\n${body}`;

/** A post with just enough set for the collection helpers. */
function post(slug: string, extra: Partial<Post> = {}): Post {
	return {
		slug,
		file: `/posts/${slug}.md`,
		url: `/posts/${slug}/`,
		title: slug,
		date: new Date('2021-01-01'),
		tags: ['post'],
		draft: false,
		source: '',
		html: '',
		...extra
	};
}

describe('parsePost', () => {
	it('reads the front matter', () => {
		const parsed = parsePost(
			'/posts/explicit-esm.md',
			doc(
				[
					'title: Explicit ESM in Node.js with .mjs',
					'description: A brief explainer.',
					'date: 2021-06-16',
					'topic: Node.js',
					'tags:',
					'  - post',
					'  - node',
					'  - webdev,',
					'series: esm-in-node-js',
					'part: 1',
					'atUri: "at://did:plc:abc/site.standard.document/3abc"'
				].join('\n'),
				'Some *text*.\n'
			)
		);

		expect(parsed).toMatchObject({
			slug: 'explicit-esm',
			file: '/posts/explicit-esm.md',
			url: '/posts/explicit-esm/',
			title: 'Explicit ESM in Node.js with .mjs',
			description: 'A brief explainer.',
			topic: 'Node.js',
			// kept as written, post tag and stray comma included
			tags: ['post', 'node', 'webdev,'],
			series: 'esm-in-node-js',
			// a number in YAML, a string here
			part: '1',
			atUri: 'at://did:plc:abc/site.standard.document/3abc',
			draft: false,
			source: 'Some *text*.\n',
			html: '<p>Some <em>text</em>.</p>\n'
		});
		// front matter dates are midnight UTC
		expect(parsed.date.toISOString()).toBe('2021-06-16T00:00:00.000Z');
		expect(parsed.updatedAt).toBeUndefined();
	});

	it('leaves optional fields out', () => {
		const parsed = parsePost('/posts/a.md', doc('title: A\ndate: 2020-01-01'));
		expect(parsed.description).toBeUndefined();
		expect(parsed.topic).toBeUndefined();
		expect(parsed.series).toBeUndefined();
		expect(parsed.part).toBeUndefined();
		expect(parsed.atUri).toBeUndefined();
		expect(parsed.tags).toEqual([]);
		expect(parsed.draft).toBe(false);
	});

	it('only takes a list of tags', () => {
		expect(parsePost('/posts/a.md', doc('title: A\ndate: 2020-01-01\ntags: post')).tags).toEqual(
			[]
		);
		expect(
			parsePost('/posts/a.md', doc('title: A\ndate: 2020-01-01\ntags: [post, 2020]')).tags
		).toEqual(['post', '2020']);
	});

	it('is a draft only when draft is exactly true', () => {
		expect(parsePost('/posts/a.md', doc('title: A\ndate: 2020-01-01\ndraft: true')).draft).toBe(
			true
		);
		expect(parsePost('/posts/a.md', doc('title: A\ndate: 2020-01-01\ndraft: "yes"')).draft).toBe(
			false
		);
	});

	it('reads updatedAt, or updated', () => {
		const a = parsePost('/posts/a.md', doc('title: A\ndate: 2020-01-01\nupdatedAt: 2020-02-03'));
		expect(a.updatedAt?.toISOString()).toBe('2020-02-03T00:00:00.000Z');

		const b = parsePost('/posts/b.md', doc('title: B\ndate: 2020-01-01\nupdated: "2020-03-04"'));
		expect(b.updatedAt?.toISOString()).toBe('2020-03-04T00:00:00.000Z');

		const both = parsePost(
			'/posts/c.md',
			doc('title: C\ndate: 2020-01-01\nupdatedAt: 2020-05-06\nupdated: 2020-07-08')
		);
		expect(both.updatedAt?.toISOString()).toBe('2020-05-06T00:00:00.000Z');
	});

	it('accepts a quoted date string', () => {
		const parsed = parsePost('/posts/a.md', doc('title: A\ndate: "2019-04-15"'));
		expect(parsed.date.toISOString()).toBe('2019-04-15T00:00:00.000Z');
	});

	it('throws for a file outside posts/ or without .md', () => {
		const raw = doc('title: A\ndate: 2020-01-01');
		expect(() => parsePost('/drafts/a.md', raw)).toThrow('Not a post: /drafts/a.md');
		expect(() => parsePost('/posts/a.txt', raw)).toThrow('Not a post: /posts/a.txt');
		expect(() => parsePost('posts/a.md', raw)).toThrow('Not a post');
	});

	it('throws without a valid date', () => {
		expect(() => parsePost('/posts/a.md', doc('title: A'))).toThrow(
			'/posts/a.md has no valid date'
		);
		expect(() => parsePost('/posts/a.md', doc('title: A\ndate: someday'))).toThrow(
			'/posts/a.md has no valid date'
		);
	});

	describe('the excerpt separator, which is taken out of the post', () => {
		const front = 'title: A\ndate: 2020-01-01';

		it('is removed with the newline after it, and the excerpt trimmed', () => {
			const parsed = parsePost(
				'/posts/a.md',
				doc(front, `Intro paragraph. ${EXCERPT_SEPARATOR}\n\nThe rest.\n`)
			);
			expect(parsed.source).toBe('Intro paragraph.\n\nThe rest.\n');
			expect(parsed.html).toBe('<p>Intro paragraph.</p>\n<p>The rest.</p>\n');
		});

		it('trims blank lines around an excerpt on its own lines', () => {
			const parsed = parsePost(
				'/posts/a.md',
				doc(front, `\nIntro.\n\n${EXCERPT_SEPARATOR}\n\nThe rest.\n`)
			);
			expect(parsed.source).toBe('Intro.\n\nThe rest.\n');
		});

		it('is removed on its own when no newline follows it, leaving the excerpt as is', () => {
			const parsed = parsePost('/posts/a.md', doc(front, `Intro ${EXCERPT_SEPARATOR}and more.\n`));
			expect(parsed.source).toBe('Intro and more.\n');
		});

		it('leaves a post without one untouched', () => {
			const parsed = parsePost('/posts/a.md', doc(front, '  Just a body.\n\nTwo paragraphs.\n'));
			expect(parsed.source).toBe('  Just a body.\n\nTwo paragraphs.\n');
		});
	});
});

describe('sortPosts', () => {
	it('sorts oldest first', () => {
		const a = post('a', { date: new Date('2021-01-01') });
		const b = post('b', { date: new Date('2020-01-01') });
		const c = post('c', { date: new Date('2022-01-01') });
		expect(sortPosts([a, b, c]).map((p) => p.slug)).toEqual(['b', 'a', 'c']);
	});

	it('sorts posts on the same day by file name', () => {
		const date = new Date('2021-06-16');
		const explicit = post('explicit', { date });
		const implicit = post('implicit', { date });
		expect(sortPosts([implicit, explicit]).map((p) => p.slug)).toEqual(['explicit', 'implicit']);
		expect(sortPosts([explicit, implicit]).map((p) => p.slug)).toEqual(['explicit', 'implicit']);
	});

	it('keeps the input order for a complete tie, and leaves the input alone', () => {
		const first = post('same', { title: 'first' });
		const second = post('same', { title: 'second' });
		const input = [first, second];
		expect(sortPosts(input).map((p) => p.title)).toEqual(['first', 'second']);
		expect(sortPosts(input)).not.toBe(input);
	});
});

describe('parsePosts', () => {
	it('parses and sorts every file', () => {
		const posts = parsePosts({
			'/posts/b.md': doc('title: B\ndate: 2021-01-01'),
			'/posts/a.md': doc('title: A\ndate: 2021-01-01'),
			'/posts/old.md': doc('title: Old\ndate: 2019-01-01')
		});
		expect(posts.map((p) => p.slug)).toEqual(['old', 'a', 'b']);
	});
});

describe('topics', () => {
	it('lists each topic once, most recently written about first', () => {
		const posts = [
			post('a', { topic: 'npm' }),
			post('b', { topic: 'Node.js' }),
			post('c'),
			post('d', { topic: 'npm' }),
			post('e', { topic: 'AT Protocol' })
		];
		expect(topics(posts)).toEqual(['AT Protocol', 'npm', 'Node.js']);
	});

	it('is empty without topics', () => {
		expect(topics([])).toEqual([]);
		expect(topics([post('a')])).toEqual([]);
	});
});

describe('seriesTotal', () => {
	it('counts the posts in a series', () => {
		const posts = [
			post('a', { series: 'esm-in-node-js' }),
			post('b'),
			post('c', { series: 'esm-in-node-js' }),
			post('d', { series: 'other' })
		];
		expect(seriesTotal(posts, 'esm-in-node-js')).toBe(2);
		expect(seriesTotal(posts, 'other')).toBe(1);
		expect(seriesTotal(posts, 'none')).toBe(0);
	});
});

describe('collectSeries', () => {
	const day = new Date('2021-06-16');

	it('orders each series by part, dated by its newest post', () => {
		const posts = [
			post('implicit', { series: 'esm-in-node-js', part: '2', date: day, title: 'Implicit' }),
			post('explicit', { series: 'esm-in-node-js', part: '1', date: day, title: 'Explicit' }),
			post('unrelated', { date: new Date('2021-06-17') }),
			post('conditional', {
				series: 'esm-in-node-js',
				part: '3',
				date: new Date('2021-06-17'),
				title: 'Conditional',
				description: 'On conditional exports.'
			})
		];
		const series = collectSeries(posts);

		expect(series).toHaveLength(1);
		expect(series[0]).toMatchObject({
			slug: 'esm-in-node-js',
			title: 'ESM in Node.js',
			description: 'Stepping through various bits of developer experience around ESM in Node.js.'
		});
		expect(series[0].date.toISOString()).toBe('2021-06-17T00:00:00.000Z');
		expect(series[0].posts).toEqual([
			{ title: 'Explicit', description: undefined, date: day, url: '/posts/explicit/', part: '1' },
			{ title: 'Implicit', description: undefined, date: day, url: '/posts/implicit/', part: '2' },
			{
				title: 'Conditional',
				description: 'On conditional exports.',
				date: new Date('2021-06-17'),
				url: '/posts/conditional/',
				part: '3'
			}
		]);
	});

	it('leaves out a series with only one post', () => {
		expect(collectSeries([post('a', { series: 'esm-in-node-js', part: '1' }), post('b')])).toEqual(
			[]
		);
		expect(collectSeries([])).toEqual([]);
	});

	it('throws for a series series.ts does not know', () => {
		expect(() => collectSeries([post('a', { series: 'mystery' })])).toThrow(
			'/posts/a.md names series "mystery", which isn\'t in series.ts'
		);
	});
});

describe('loadPosts (the real posts)', () => {
	it('loads all fourteen posts, oldest first', () => {
		const posts = loadPosts();
		expect(posts).toHaveLength(14);

		const times = posts.map((p) => p.date.getTime());
		expect(times).toEqual(times.toSorted((a, b) => a - b));
		expect(posts[0].slug).toBe('my-first-experience-attending-tc39');
		expect(posts.at(-1)?.slug).toBe('what-is-the-atmosphere');
	});

	it('orders the two ESM posts from the same day by file name', () => {
		const slugs = loadPosts().map((p) => p.slug);
		const explicit = slugs.indexOf('explicit-esm-in-node-js-with-mjs');
		const implicit = slugs.indexOf('implicit-esm-in-node-js-with-type-module');
		expect(explicit).toBeGreaterThan(-1);
		expect(implicit).toBe(explicit + 1);
	});

	it('parses each post once', () => {
		expect(loadPosts()).toBe(loadPosts());
	});

	it('takes the excerpt separator out of every post', () => {
		for (const p of loadPosts()) {
			expect(p.source, p.file).not.toContain(EXCERPT_SEPARATOR);
			expect(p.html, p.file).not.toContain(EXCERPT_SEPARATOR);
		}
	});

	it('has the ESM series in three parts', () => {
		const posts = loadPosts();
		expect(seriesTotal(posts, 'esm-in-node-js')).toBe(3);
		const [esm] = collectSeries(posts);
		expect(esm.posts.map((p) => p.part)).toEqual(['1', '2', '3']);
		expect(esm.date.toISOString()).toBe('2021-06-17T00:00:00.000Z');
	});
});

describe('findPost', () => {
	it('finds a post by slug', () => {
		const found = findPost('is-mdm');
		expect(found?.title).toBe('is-mdm: MDM detection in Node.js');
		expect(found?.url).toBe('/posts/is-mdm/');
	});

	it('finds nothing for an unknown slug', () => {
		expect(findPost('no-such-post')).toBeUndefined();
	});
});
