import fs from 'node:fs';
import path from 'node:path';
import { isHttpError } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const DESCRIPTION = /^An introduction to the ecosystem/;

// The Bluesky embed comes from a cached copy of the thread, as fresh as the
// day it was fetched, so the test never reaches the network.
vi.mock('$lib/server/bluesky', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/bluesky')>();
	const cacheDir = path.join(import.meta.dirname, '../../../lib/server/fixtures/bluesky');
	const { fetchedAt } = JSON.parse(
		fs.readFileSync(path.join(cacheDir, 'bnb.im-3mwvwapoefs26.json'), 'utf8')
	);
	const offline = () => Promise.reject(new Error('no network in tests'));
	return {
		...actual,
		embedBlueskyPosts: (html: string) =>
			actual.embedBlueskyPosts(html, { cacheDir, fetch: offline, now: () => fetchedAt })
	};
});

// lets a test add a post (a draft, say) alongside the real ones
const extra = vi.hoisted(() => ({ posts: [] as import('$lib/server/posts').Post[] }));
vi.mock('$lib/server/posts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/posts')>();
	return { ...actual, loadPosts: () => [...actual.loadPosts(), ...extra.posts] };
});

const { parsePost } = await import('$lib/server/posts');
const { entries, load } = await import('./+page.server');

type LoadEvent = Parameters<typeof load>[0];

async function run(slug: string) {
	const data = await load({ params: { slug } } as LoadEvent);
	if (!data) throw new Error('load() returned nothing');
	return data;
}

describe('post page', () => {
	afterEach(() => {
		extra.posts = [];
	});

	it('prerenders a page for every post', async () => {
		const slugs = (await entries()).map(({ slug }) => slug);
		expect(slugs).toHaveLength(14);
		expect(new Set(slugs).size).toBe(14);
		expect(slugs).toContain('what-is-the-atmosphere');
		expect(slugs).toContain('is-mdm');
	});

	it('gives the page everything it shows', async () => {
		const data = await run('what-is-the-atmosphere');
		expect(data).toMatchObject({
			slug: 'what-is-the-atmosphere',
			url: '/posts/what-is-the-atmosphere/',
			title: 'What is the Atmosphere: An Untech Introduction',
			titleHtml: 'What is the Atmosphere: An Untech Introduction',
			date: '2026-10-02',
			dotDate: '02.10.2026',
			topic: 'AT Protocol',
			series: undefined,
			tags: ['atmosphere', 'beginners'],
			subscribe: {
				publication:
					'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.publication/3mtxb2uyta22l',
				script: '/standard-site/subscribe.js'
			},
			discussion: {
				subject: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.document/3mwwg6sy4e32e',
				script: '/standard-site/discussion.js',
				hide: ''
			}
		});
		expect(data.description).toMatch(DESCRIPTION);
		expect(data.readingTime).toBeGreaterThan(1);
	});

	it('turns the Bluesky post link into an embed', async () => {
		const { html } = await run('what-is-the-atmosphere');
		expect(html).toContain(
			'<blockquote class="bsky-embed" cite="https://bsky.app/profile/bnb.im/post/3mwvwapoefs26">'
		);
		expect(html).toContain('think about it like an email account');
		expect(html).not.toContain('<p><a href="https://bsky.app/profile/bnb.im/post/3mwvwapoefs26">');
		// the rest of the post is still there, with its heading permalinks
		expect(html).toContain('class="direct-link"');
	});

	it("links the page to the post's record and the publication", async () => {
		const { postTags } = await run('what-is-the-atmosphere');
		const uri = 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.document/3mwwg6sy4e32e';
		expect(postTags).toEqual([
			{ name: 'at:canonical', content: uri },
			{
				name: 'at:alternate',
				content: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.publication/3mtxb2uyta22l'
			},
			{ name: 'at:author', content: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c' },
			{ rel: 'site.standard.document', href: uri },
			{
				rel: 'site.standard.publication',
				href: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.publication/3mtxb2uyta22l'
			}
		]);
	});

	it('renders inline Markdown in the title', async () => {
		const data = await run('jest-and-the-changedsince-flag-in-github-actions-ci');
		expect(data.title).toBe('Jest and the `--changedSince` flag in GitHub Actions CI');
		expect(data.titleHtml).toBe(
			'Jest and the <code>--changedSince</code> flag in GitHub Actions CI'
		);
	});

	it('labels a series post with its part', async () => {
		const data = await run('implicit-esm-in-node-js-with-type-module');
		expect(data.series).toEqual({ label: 'ESM in Node.js 2/3', url: '/series/esm-in-node-js/' });
		expect(data.dotDate).toBe('16.06.2021');
	});

	it('shows tags without the post tag or stray commas', async () => {
		const data = await run('the-awesome-features-that-just-landed-with-node-js-v12');
		expect(data.tags).toEqual(['node', 'javascript', 'webdev', 'opensource']);
	});

	it('leaves a post without Bluesky links as rendered', async () => {
		const data = await run('is-mdm');
		expect(data.html).not.toContain('bsky-embed');
		expect(data.html).toContain('<a href="https://bsky.app/profile/lgug2z.com">LGUG2Z</a>');
	});

	it('renders a draft, which has no record to link yet', async () => {
		extra.posts = [
			parsePost(
				'/posts/a-draft.md',
				'---\ntitle: A draft\ndate: 2026-10-03\ndraft: true\n---\nSoon.\n'
			)
		];
		expect((await entries()).map(({ slug }) => slug)).toContain('a-draft');

		const data = await run('a-draft');
		expect(data).toMatchObject({
			title: 'A draft',
			html: '<p>Soon.</p>\n',
			tags: [],
			readingTime: 1
		});
		expect(data.postTags).toEqual([]);
		// upvotes and comments are on the record, so a draft has neither
		expect(data.discussion).toBeNull();
	});

	it('is a 404 for a post that does not exist', async () => {
		const error = await run('no-such-post').catch((thrown: unknown) => thrown);
		expect(isHttpError(error, 404)).toBe(true);
		expect(error).toMatchObject({ body: { message: 'Not found' } });
	});
});
