import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Post } from './posts';
import { loadPosts } from './posts';
import type { PublishDocument, StandardSite } from './publish';
import { publish, toDocuments, unlinkedPosts } from './publish';
import { DID, DOCUMENT, PUBLICATION, deterministicTid } from './standard-site';

const ROOT = path.resolve('/srv/bnb.im');

function post(slug: string, extra: Partial<Post> = {}): Post {
	return {
		slug,
		file: `/posts/${slug}.md`,
		url: `/posts/${slug}/`,
		title: slug,
		date: new Date('2021-01-01'),
		tags: ['post'],
		draft: false,
		source: `# ${slug}\n\nBody of ${slug}.\n`,
		html: '',
		...extra
	};
}

/** Stands in for @bnb/standard-site's markdown-it token → leaflet block converter. */
function fakeTokensToBlocks() {
	return vi.fn<StandardSite['tokensToBlocks']>((tokens, options) => ({
		blocks: tokens
			.filter((token) => token.type.endsWith('_open'))
			.map((token) => ({ $type: token.tag, plaintext: '' })),
		textContent: (options?.source ?? '').trim()
	}));
}

describe('toDocuments', () => {
	const pinned = `at://${DID}/${DOCUMENT}/3mtxb3lixqw2v`;
	const posts = [
		post('pinned', {
			title: 'Pinned',
			description: 'Already published.',
			date: new Date('2025-10-30'),
			tags: ['post', 'javascript', 'webdev,', 'node'],
			atUri: pinned
		}),
		post('draft', { draft: true }),
		post('fresh', {
			title: 'Fresh',
			date: new Date('2026-10-02'),
			updatedAt: new Date('2026-10-03'),
			tags: ['post']
		})
	];

	it('builds a record for every post but drafts', () => {
		const documents = toDocuments(posts, { root: ROOT, tokensToBlocks: fakeTokensToBlocks() });
		expect(documents.map((doc) => doc.fileSlug)).toEqual(['pinned', 'fresh']);
	});

	it('carries over what each post says', () => {
		const [first, second] = toDocuments(posts, {
			root: ROOT,
			tokensToBlocks: fakeTokensToBlocks()
		});

		expect(first).toEqual<PublishDocument>({
			inputPath: path.join(ROOT, 'posts', 'pinned.md'),
			url: '/posts/pinned/',
			fileSlug: 'pinned',
			uri: pinned,
			pinned: true,
			title: 'Pinned',
			description: 'Already published.',
			date: new Date('2025-10-30'),
			updatedAt: undefined,
			// the collection tag goes; the rest stay exactly as written
			tags: ['javascript', 'webdev,', 'node'],
			fixedDate: true,
			blocks: [
				{ $type: 'h1', plaintext: '' },
				{ $type: 'p', plaintext: '' }
			],
			textContent: '# pinned\n\nBody of pinned.'
		});
		expect(second).toMatchObject({
			inputPath: path.join(ROOT, 'posts', 'fresh.md'),
			uri: `at://${DID}/${DOCUMENT}/${deterministicTid(new Date('2026-10-02'), 'fresh')}`,
			pinned: false,
			updatedAt: new Date('2026-10-03'),
			tags: [],
			fixedDate: true
		});
	});

	it("converts each post's markdown-it tokens with its source and absolute URL", () => {
		const tokensToBlocks = fakeTokensToBlocks();
		toDocuments(posts, { root: ROOT, tokensToBlocks });

		expect(tokensToBlocks).toHaveBeenCalledTimes(2);
		const [tokens, options] = tokensToBlocks.mock.calls[0];
		expect(tokens.map((token) => token.type)).toEqual([
			'heading_open',
			'inline',
			'heading_close',
			'paragraph_open',
			'inline',
			'paragraph_close'
		]);
		expect(options).toEqual({
			source: '# pinned\n\nBody of pinned.\n',
			baseUrl: 'https://bnb.im/posts/pinned/',
			blueskyPosts: true,
			breaks: true
		});
		expect(tokensToBlocks.mock.calls[1][1]?.baseUrl).toBe('https://bnb.im/posts/fresh/');
	});

	it('turns pull quotes, code tabs and footnotes into plain leaflet blocks', () => {
		const source = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/features.md'), 'utf8');
		const [doc] = toDocuments([post('features', { source })], { root: ROOT });
		const TEXT = 'pub.leaflet.blocks.text';
		const QUOTE = 'pub.leaflet.blocks.blockquote';
		const CODE = 'pub.leaflet.blocks.code';
		const ITEM = 'pub.leaflet.blocks.orderedList#listItem';

		expect(doc.blocks).toMatchObject([
			// references keep their [n] captions
			{ $type: TEXT, plaintext: 'A paragraph with a note.[1] And one written inline.[2]' },
			// a pull quote is a blockquote, without its marker
			{ $type: QUOTE, plaintext: 'Garbage, but selected.' },
			{ $type: QUOTE, plaintext: 'An ordinary quote stays ordinary.' },
			// the file name stays out of the code's language
			{ $type: CODE, plaintext: 'const answer = 42;', language: 'js' },
			{ $type: CODE, plaintext: 'on: push', language: 'yaml' },
			{ $type: TEXT, plaintext: 'Another mention of the first note.[1:1]' },
			// the notes are a numbered list after a rule, as on the page
			{ $type: 'pub.leaflet.blocks.horizontalRule' },
			{
				$type: 'pub.leaflet.blocks.orderedList',
				children: [
					{
						$type: ITEM,
						content: {
							plaintext: 'Because a link fits better down here.',
							facets: [
								{
									index: { byteStart: 10, byteEnd: 14 },
									features: [{ uri: 'https://atproto.com/' }]
								}
							]
						}
					},
					{ $type: ITEM, content: { plaintext: 'Short and sweet.' } }
				]
			}
		]);
		expect(doc.blocks).toHaveLength(8);
		expect(doc.textContent).not.toContain('[!PULL]');
	});

	it('fails on an atUri from another repository', () => {
		expect(() =>
			toDocuments([post('foreign', { atUri: 'at://did:plc:other/site.standard.document/3abc' })], {
				root: ROOT,
				tokensToBlocks: fakeTokensToBlocks()
			})
		).toThrow("isn't a site.standard.document");
	});
});

describe('publish', () => {
	function engine() {
		return {
			tokensToBlocks: fakeTokensToBlocks(),
			sync: vi.fn<StandardSite['sync']>(async () => {})
		};
	}

	it('syncs every post to the publication', async () => {
		const fake = engine();
		const outputDir = path.join(ROOT, 'build');
		const credentials = { identifier: 'bnb.example' };

		const documents = await publish({
			root: ROOT,
			outputDir,
			dryRun: true,
			prune: false,
			standardSite: fake,
			credentials
		});

		expect(documents).toHaveLength(loadPosts().length);
		expect(fake.tokensToBlocks).toHaveBeenCalledTimes(documents.length);
		expect(fake.sync).toHaveBeenCalledOnce();

		const [options] = fake.sync.mock.calls[0];
		expect(options).toMatchObject({
			documents,
			publication: PUBLICATION,
			siteUrl: 'https://bnb.im',
			inputDir: ROOT,
			outputDir,
			credentials,
			dryRun: true,
			prune: false
		});
		const atmosphere = documents.find((doc) => doc.fileSlug === 'what-is-the-atmosphere')!;
		expect(atmosphere.inputPath).toBe(path.join(ROOT, 'posts', 'what-is-the-atmosphere.md'));
		expect(options.coverImage?.(atmosphere)).toBe(
			path.join(outputDir, 'img', 'social', 'what-is-the-atmosphere.png')
		);
	});

	it('passes a real run and pruning through', async () => {
		const fake = engine();
		await publish({
			root: ROOT,
			outputDir: '/tmp/out',
			dryRun: false,
			prune: true,
			standardSite: fake,
			credentials: {}
		});
		expect(fake.sync.mock.calls[0][0]).toMatchObject({ dryRun: false, prune: true });
	});

	it('keeps every post on the record it was published as', async () => {
		const documents = await publish({
			root: ROOT,
			outputDir: '/tmp/out',
			dryRun: true,
			prune: false,
			standardSite: engine(),
			credentials: {}
		});
		const posts = new Map(loadPosts().map((p) => [p.slug, p]));
		for (const doc of documents) {
			expect(doc.uri).toBe(posts.get(doc.fileSlug)?.atUri);
			expect(doc.pinned).toBe(true);
			expect(doc.tags).not.toContain('post');
		}
		// a stray comma in the front matter goes to the PDS as written, as it always has
		expect(
			documents.find(
				(doc) => doc.fileSlug === 'the-awesome-features-that-just-landed-with-node-js-v12'
			)?.tags
		).toEqual(['node', 'javascript', 'webdev,', 'opensource']);
	});
});

describe('unlinkedPosts', () => {
	const URI = 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.document/3mtxb3lixqw2v';

	function site(posts: Record<string, { frontMatter: string; html?: string }>) {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-'));
		const outputDir = path.join(root, 'build');
		fs.mkdirSync(path.join(root, 'posts'));
		for (const [slug, { frontMatter, html }] of Object.entries(posts)) {
			fs.writeFileSync(path.join(root, 'posts', `${slug}.md`), `---\n${frontMatter}\n---\nBody\n`);
			if (html !== undefined) {
				fs.mkdirSync(path.join(outputDir, 'posts', slug), { recursive: true });
				fs.writeFileSync(path.join(outputDir, 'posts', slug, 'index.html'), html);
			}
		}
		return { root, outputDir };
	}

	it('finds posts whose page doesn’t link the record they’re pinned to, or that aren’t pinned', () => {
		const link = `<link rel="site.standard.document" href="${URI}"/>`;
		const dirs = site({
			linked: { frontMatter: `atUri: "${URI}"`, html: link },
			stale: { frontMatter: `atUri: "${URI}"`, html: '<html></html>' },
			unpinned: { frontMatter: 'title: New', html: link },
			draft: { frontMatter: 'draft: true' }
		});
		expect(unlinkedPosts(dirs).toSorted()).toEqual(['stale', 'unpinned']);
	});
});
