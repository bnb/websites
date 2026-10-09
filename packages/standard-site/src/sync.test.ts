import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blobCid } from './bytes';
import { toContent, type RichTextBlock } from './leaflet';
import { limiter, localPaths, sync, type Document, type SyncOptions, type Write } from './sync';
import { json } from './test/fetch';
import {
	DID,
	fakePds,
	png,
	PUBLICATION,
	PUBLICATION_RKEY,
	SITE,
	type FakePds
} from './test/fake-pds';
import { convert } from './test/markdown';
import { useTmpDir } from './test/tmp';

const tmp = useTmpDir();
let pds: FakePds;

// a real CID, for strong refs; the lexicons check the format
const CID = blobCid(Buffer.from('a post'));
const IMAGE = 'pub.leaflet.blocks.image';
const TEXT = 'pub.leaflet.blocks.text';

type Fields = Partial<Record<keyof Document | 'rkey', unknown>>;

// a post written to the temporary directory, converted the way a site would
function doc(slug: string, markdown: string, { rkey, ...fields }: Fields = {}): Document {
	const inputPath = path.join(tmp.path, `${slug}.md`);
	fs.writeFileSync(inputPath, `---\ntitle: ${slug}\n---\n${markdown}\n`);
	const { blocks, textContent } = convert(markdown, { baseUrl: `${SITE}/posts/${slug}/` });
	return {
		inputPath,
		url: `/posts/${slug}/`,
		fileSlug: slug,
		uri: `at://${DID}/site.standard.document/${(rkey as string | undefined) ?? `3l${slug.padEnd(11, '2')}`}`,
		pinned: true,
		fixedDate: true,
		title: slug,
		date: new Date('2026-01-01T00:00:00Z'),
		tags: [],
		blocks,
		textContent,
		...fields
	} as Document;
}

const rkeyOf = (d: Document) => d.uri.split('/').pop()!;
const keyOf = (d: Document) => `site.standard.document/${rkeyOf(d)}`;
const recordOf = (d: Document) => pds.records[keyOf(d)] as Record<string, unknown> | undefined;
const blocksOf = (d: Document) =>
	(recordOf(d)!.content as ReturnType<typeof toContent>).pages[0].blocks.map(
		(b) => b.block as RichTextBlock & Record<string, unknown>
	);
const publicationRecord = () => pds.records[`site.standard.publication/${PUBLICATION_RKEY}`];
// what was logged, one message per call
const messages = (method: 'log' | 'warn') =>
	vi.mocked(console[method]).mock.calls.map((call) => String(call[0]));
// and all of it together, to look for part of a message in
const logged = (method: 'log' | 'warn') => messages(method).join('\n');

// what a record for `doc` looks like once published, for seeding the PDS
const published = (d: Document, extra: Record<string, unknown> = {}) => ({
	$type: 'site.standard.document',
	site: PUBLICATION,
	path: d.url,
	title: d.title,
	publishedAt: d.date.toISOString(),
	textContent: d.textContent,
	content: toContent(d.blocks!),
	canonicalUrl: `${SITE}${d.url}`,
	...extra
});

const run = (documents: Document[], options: Partial<SyncOptions> = {}) =>
	sync({
		documents,
		publication: { uri: PUBLICATION, name: 'Test' },
		siteUrl: SITE,
		inputDir: tmp.path,
		credentials: { password: 'secret' },
		...options
	});

beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('sync', () => {
	it('writes new and changed records, and leaves unchanged ones alone', async () => {
		const same = doc('same', 'Unchanged.');
		const changed = doc('changed', 'New words.');
		const fresh = doc('fresh', 'Brand new.');
		pds = fakePds({
			records: {
				[keyOf(same)]: published(same),
				[keyOf(changed)]: published(doc('changed', 'Old words.'))
			}
		});

		await expect(run([same, changed, fresh])).resolves.toEqual({
			created: 1,
			updated: 1,
			unchanged: 1,
			orphans: 0
		});

		expect(pds.writes).toEqual([
			['put', 'site.standard.document', rkeyOf(changed)],
			['put', 'site.standard.document', rkeyOf(fresh)]
		]);
		expect(recordOf(changed)!.textContent).toBe('New words.');
		expect(recordOf(fresh)!.textContent).toBe('Brand new.');
		expect(messages('log')).toContain(
			'[standard-site] Published: 1 created, 1 updated, 1 unchanged'
		);
	});

	it('fills in the record from the post', async () => {
		pds = fakePds();
		const d = doc('full', 'Hi.', {
			description: 'About it',
			tags: ['notes', 'atproto'],
			updatedAt: new Date('2026-02-03T04:05:06Z')
		});
		await run([d], { siteUrl: `${SITE}/` });
		expect(recordOf(d)).toEqual({
			$type: 'site.standard.document',
			site: PUBLICATION,
			path: '/posts/full/',
			title: 'full',
			description: 'About it',
			publishedAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-02-03T04:05:06.000Z',
			tags: ['notes', 'atproto'],
			textContent: 'Hi.',
			content: toContent([{ $type: TEXT, plaintext: 'Hi.' }]),
			canonicalUrl: 'https://example.com/posts/full/'
		});
	});

	it('puts the canonical URL under the site’s subdirectory', async () => {
		pds = fakePds({ publication: null });
		const d = doc('nested', 'Hi.');
		await run([d], { siteUrl: `${SITE}/blog/` });
		expect(recordOf(d)!.canonicalUrl).toBe('https://example.com/blog/posts/nested/');
		expect(publicationRecord().url).toBe('https://example.com/blog');
	});

	it("keeps fields on an existing record that publishing doesn't manage", async () => {
		const d = doc('kept', 'Text.');
		pds = fakePds({
			records: {
				[keyOf(d)]: published(doc('kept', 'Old.'), {
					description: 'Dropped, since the post has none now',
					tags: ['dropped'],
					bskyPostRef: { uri: `at://${DID}/app.bsky.feed.post/3kpost`, cid: CID }
				})
			}
		});

		await run([d]);

		expect(recordOf(d)!.bskyPostRef).toEqual({
			uri: `at://${DID}/app.bsky.feed.post/3kpost`,
			cid: CID
		});
		expect(recordOf(d)).not.toHaveProperty('description');
		expect(recordOf(d)).not.toHaveProperty('tags');
		expect(recordOf(d)!.textContent).toBe('Text.');
	});

	it("logs in as the publication's DID, or the identifier when one is set", async () => {
		pds = fakePds();
		await run([]);
		await run([], { credentials: { identifier: 'me.example', password: 'secret' } });
		expect(pds.logins).toEqual([DID, 'me.example']);
	});

	it("refuses to publish as an account that doesn't own the publication", async () => {
		pds = fakePds({ sessionDid: 'did:plc:someoneelse' });
		await expect(run([doc('a', 'Hi.')])).rejects.toThrow(
			'Logged in as did:plc:someoneelse, but the publication belongs to did:plc:synctest'
		);
		expect(pds.writes).toEqual([]);
	});

	it('fails the publish when logging in fails', async () => {
		pds = fakePds();
		await expect(run([doc('a', 'Hi.')], { credentials: { password: 'wrong' } })).rejects.toThrow(
			'com.atproto.server.createSession failed: 401 AuthenticationRequired Invalid password'
		);
		expect(pds.writes).toEqual([]);
	});

	it('needs a password to publish, and fails before asking the PDS anything', async () => {
		pds = fakePds();
		await expect(run([doc('a', 'Hi.')], { credentials: {} })).rejects.toThrow(
			"Set ATPROTO_APP_PASSWORD (an app password from your account settings) to publish. A dry run doesn't need one."
		);
		expect(pds.requests).toEqual([]);
	});

	it('calls onWrite for every write it makes', async () => {
		pds = fakePds({ publication: null });
		const d = doc('reported', 'Hi.');
		const writes: Write[] = [];
		await run([d], { onWrite: (write) => writes.push(write) });
		expect(writes).toEqual([
			{
				label: 'publication created',
				fields: ['$type', 'url', 'name'],
				record: publicationRecord()
			},
			{
				label: '/posts/reported/ created',
				fields: [
					'$type',
					'site',
					'path',
					'title',
					'publishedAt',
					'textContent',
					'content',
					'canonicalUrl'
				],
				record: recordOf(d)
			}
		]);
	});
});

describe('dry runs', () => {
	it('report what would change, without writing or needing a password', async () => {
		const changed = doc('edited', 'New.', { tags: ['one'] });
		const fresh = doc('draft', 'Hi.', { pinned: false });
		pds = fakePds({ records: { [keyOf(changed)]: published(doc('edited', 'Old.')) } });
		const onWrite = vi.fn();

		await expect(
			run([changed, fresh], { dryRun: true, credentials: {}, onWrite })
		).resolves.toEqual({ created: 1, updated: 1, unchanged: 0, orphans: 0 });

		expect(pds.writes).toEqual([]);
		expect(pds.logins).toEqual([]);
		expect(onWrite.mock.calls.map(([write]) => [write.label, write.fields])).toEqual([
			['/posts/edited/ updated', ['textContent', 'content', 'tags']],
			[
				'/posts/draft/ created',
				['$type', 'site', 'path', 'title', 'publishedAt', 'textContent', 'content', 'canonicalUrl']
			]
		]);
		expect(onWrite.mock.calls[1][0].record).toMatchObject({
			path: '/posts/draft/',
			title: 'draft'
		});
		expect(messages('log')).toEqual([
			'[standard-site] would be /posts/edited/ updated: textContent, content, tags',
			'[standard-site] would be /posts/draft/ created: $type, site, path, title, publishedAt, textContent, content, canonicalUrl',
			'[standard-site] Dry run: 1 created, 1 updated, 0 unchanged'
		]);
		// and nothing is pinned
		expect(fs.readFileSync(fresh.inputPath, 'utf8')).not.toContain('atUri');
	});

	it('report fields of a new publication record', async () => {
		pds = fakePds({ publication: null });
		await run([], { dryRun: true });
		expect(messages('log')).toContain(
			'[standard-site] would be publication created: $type, url, name'
		);
		expect(pds.records).toEqual({});
	});

	it("don't upload images", async () => {
		fs.writeFileSync(path.join(tmp.path, 'pic.png'), png());
		pds = fakePds();
		const onWrite = vi.fn();
		await run([doc('pic', '![pic](/pic.png)')], { dryRun: true, onWrite });
		expect(pds.uploads).toBe(0);
		// the record still says what the upload would give it
		const [{ record }] = onWrite.mock.calls.map(([write]) => write as Write);
		expect((record!.content as ReturnType<typeof toContent>).pages[0].blocks[0].block).toEqual({
			$type: IMAGE,
			image: { $type: 'blob', ref: { $link: blobCid(png()) }, mimeType: 'image/png', size: 32 },
			aspectRatio: { width: 10, height: 5 },
			alt: 'pic'
		});
	});
});

describe('pinning', () => {
	it("pins the URI into the front matter of posts that didn't have one", async () => {
		pds = fakePds();
		const d = doc('unpinned', 'Hi.', { pinned: false });
		const pinned = doc('pinned', 'Hi.');
		await run([d, pinned]);
		expect(fs.readFileSync(d.inputPath, 'utf8')).toBe(
			`---\ntitle: unpinned\natUri: "${d.uri}"\n---\nHi.\n`
		);
		expect(fs.readFileSync(pinned.inputPath, 'utf8')).not.toContain('atUri');
	});

	it("publishes posts that can't be pinned, and says how to pin them", async () => {
		pds = fakePds();
		const d = doc('jsonmatter', 'Hi.', { pinned: false });
		fs.writeFileSync(d.inputPath, '---json\n{ "title": "jsonmatter" }\n---\nHi.\n');
		await run([d]);
		expect(recordOf(d)).toBeDefined();
		expect(logged('warn')).toContain(
			`jsonmatter.md has json front matter, which only YAML is written to, so its URI can't be pinned automatically. Add \`atUri: "${d.uri}"\` to its data yourself.`
		);
		expect(fs.readFileSync(d.inputPath, 'utf8')).toBe(
			'---json\n{ "title": "jsonmatter" }\n---\nHi.\n'
		);
	});

	it('warns, rather than failing, when a pin fails after publishing', async () => {
		pds = fakePds();
		const d = doc('readonly', 'Hi.', { pinned: false });
		vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
			throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
		});
		await run([d]);
		expect(recordOf(d)).toBeDefined();
		expect(logged('warn')).toContain(
			`Couldn't pin ${d.uri} into ${d.inputPath}: EACCES: permission denied`
		);
	});
});

describe('what stops a publish', () => {
	it('refuses posts the lexicon would reject, before asking the PDS anything', async () => {
		pds = fakePds();
		const posts = [
			doc('untitled', 'Hi.', { title: undefined }),
			doc('long', 'Hi.', { title: 'é'.repeat(501) }),
			doc('tagged', 'Hi.', { tags: ['ok', 'x'.repeat(129)] }),
			doc('dated', 'Hi.', { date: new Date('someday') })
		];
		const error = (await run(posts).catch((e: unknown) => e)) as Error;
		const [heading, ...lines] = error.message.split('\n');
		expect(heading).toBe("Can't publish:");
		expect(lines.map((line) => line.replace(`  - ${tmp.path}${path.sep}`, ''))).toEqual([
			'untitled.md has no title, which a document needs',
			'long.md has a title over 500 characters',
			`tagged.md has a tag "${'x'.repeat(129)}" over 128 characters`,
			'dated.md has an invalid date'
		]);
		expect(pds.requests).toEqual([]);
	});

	it('warns about posts whose URI depends on the checkout, and publishes them', async () => {
		pds = fakePds();
		const d = doc('undated', 'Hi.', { pinned: false, fixedDate: false });
		await run([d]);
		expect(logged('warn')).toContain('undated.md has no date of its own');
		expect(recordOf(d)).toBeDefined();
	});

	it('refuses to give a post a second record when its derived URI changes', async () => {
		// published from a checkout where the post's date (from the file system)
		// was different, and never pinned
		const first = doc('moved', 'Hi.', { rkey: '3lfirst222222' });
		const again = doc('moved', 'Hi.', { rkey: '3lagain222222', pinned: false });
		pds = fakePds({ records: { [keyOf(first)]: published(first) } });
		await expect(run([again])).rejects.toThrow(
			`moved.md was published as ${first.uri}, but this build gave it ${again.uri}. Add \`atUri: "${first.uri}"\` to its front matter to keep the record it has.`
		);
		expect(pds.writes).toEqual([]);
	});

	it("refuses to let a new post take over another post's record", async () => {
		const older = doc('older', 'Hi.', { rkey: '3lshared22222', pinned: false });
		const newer = doc('newer', 'Hi.', { rkey: '3lshared22222', pinned: false });
		const bumped = doc('older', 'Hi.', { rkey: '3lbumped22222', pinned: false });
		pds = fakePds({ records: { 'site.standard.document/3lshared22222': published(older) } });
		await expect(run([newer, bumped])).rejects.toThrow(
			`${newer.inputPath} was given ${newer.uri}, which holds the record for /posts/older/. Give one of them a different \`date\`, or pin each with \`atUri\`.`
		);
		expect(pds.writes).toEqual([]);
	});

	it('lets an unpinned post whose permalink changed keep its record', async () => {
		const before = doc('renamed', 'Hi.', { pinned: false });
		const after = { ...before, url: '/writing/renamed/' };
		pds = fakePds({ records: { [keyOf(before)]: published(before) } });
		await expect(run([after])).resolves.toMatchObject({ created: 0, updated: 1 });
		expect(recordOf(after)!.path).toBe('/writing/renamed/');
	});

	it('refuses to overwrite a record that belongs to another publication, before uploading', async () => {
		fs.writeFileSync(path.join(tmp.path, 'pic.png'), png());
		const d = doc('taken', '![pic](/pic.png)');
		pds = fakePds({
			records: {
				[keyOf(d)]: { ...published(d), site: 'at://did:plc:else/site.standard.publication/3lp' }
			}
		});
		await expect(run([d])).rejects.toThrow(
			`${d.uri} already holds a record for at://did:plc:else/site.standard.publication/3lp, refusing to overwrite it`
		);
		expect(pds.writes).toEqual([]);
		expect(pds.uploads).toBe(0);
	});

	it('needs a name for a new publication', async () => {
		pds = fakePds({ publication: null });
		await expect(run([], { publication: { uri: PUBLICATION, name: '' } })).rejects.toThrow(
			'The publication needs a name.'
		);
		expect(pds.writes).toEqual([]);
	});
});

describe('the publication record', () => {
	it('is created on the first publish', async () => {
		pds = fakePds({ publication: null });
		await run([], { siteUrl: `${SITE}/` });
		expect(pds.writes).toEqual([['put', 'site.standard.publication', PUBLICATION_RKEY]]);
		expect(publicationRecord()).toEqual({
			$type: 'site.standard.publication',
			url: SITE,
			name: 'Test'
		});
	});

	it('is updated with the options that changed, keeping the rest', async () => {
		const icon = { $type: 'blob', ref: { $link: blobCid(png()) }, mimeType: 'image/png', size: 32 };
		pds = fakePds({
			publication: {
				$type: 'site.standard.publication',
				url: SITE,
				name: 'Test',
				icon,
				preferences: { other: true }
			}
		});
		await run([], {
			publication: { uri: PUBLICATION, name: 'Renamed', description: 'New', showInDiscover: true }
		});
		expect(pds.writes).toEqual([['put', 'site.standard.publication', PUBLICATION_RKEY]]);
		expect(publicationRecord()).toEqual({
			$type: 'site.standard.publication',
			url: SITE,
			name: 'Renamed',
			description: 'New',
			icon,
			preferences: { other: true, showInDiscover: true }
		});
		expect(messages('log')).toContain(
			'[standard-site] Published: 0 created, 0 updated, 0 unchanged'
		);
	});

	it('can be kept out of discovery, and keeps an existing name and description', async () => {
		pds = fakePds({
			publication: {
				$type: 'site.standard.publication',
				url: SITE,
				name: 'Kept',
				description: 'Too'
			}
		});
		await run([], { publication: { uri: PUBLICATION, name: '', showInDiscover: false } });
		expect(publicationRecord()).toEqual({
			$type: 'site.standard.publication',
			url: SITE,
			name: 'Kept',
			description: 'Too',
			preferences: { showInDiscover: false }
		});
	});

	it('is left alone when nothing changed', async () => {
		pds = fakePds();
		await run([]);
		expect(pds.writes).toEqual([]);
	});
});

describe('orphans', () => {
	it('are reported, and deleted only with prune', async () => {
		const orphan = doc('orphan', 'Gone.');
		const pathless = doc('pathless', 'Gone too.');
		const records = {
			[keyOf(orphan)]: published(orphan),
			[keyOf(pathless)]: { ...published(pathless), path: undefined },
			// another publication's record in the same repo isn't an orphan
			'site.standard.document/3lother222222': {
				...published(doc('other', 'Theirs.')),
				site: 'at://did:plc:else/site.standard.publication/3lp'
			}
		};

		pds = fakePds({ records });
		await expect(run([])).resolves.toMatchObject({ orphans: 2 });
		expect(pds.writes).toEqual([]);
		expect(logged('warn')).toContain(
			`${orphan.uri} (/posts/orphan/) doesn't match any post. Prune to delete it.`
		);
		expect(logged('warn')).toContain(`${pathless.uri} (no path) doesn't match any post.`);
		expect(messages('log')).toContain(
			'[standard-site] Published: 0 created, 0 updated, 0 unchanged, 2 orphaned'
		);

		const onWrite = vi.fn();
		await run([], { prune: true, dryRun: true, onWrite });
		expect(pds.writes).toEqual([]);
		expect(onWrite.mock.calls.map(([write]) => write)).toEqual([
			{ label: '/posts/orphan/ deleted', fields: [] },
			{ label: `${pathless.uri} deleted`, fields: [] }
		]);
		expect(messages('log')).toContain('[standard-site] would be /posts/orphan/ deleted');

		await run([], { prune: true });
		expect(pds.writes).toEqual([
			['delete', 'site.standard.document', rkeyOf(orphan)],
			['delete', 'site.standard.document', rkeyOf(pathless)]
		]);
		expect(messages('log')).toContain(
			'[standard-site] Published: 0 created, 0 updated, 0 unchanged, 2 orphaned (deleted)'
		);
		expect(Object.keys(pds.records)).toContain('site.standard.document/3lother222222');
	});
});

describe('posts without content', () => {
	it("leave a published post's record as it is", async () => {
		const d = doc('kept', 'Hi.');
		pds = fakePds({ records: { [keyOf(d)]: published(d) } });
		await expect(run([{ ...d, blocks: undefined, textContent: undefined }])).resolves.toEqual({
			created: 0,
			updated: 0,
			unchanged: 0,
			orphans: 0
		});
		expect(pds.writes).toEqual([]);
		expect(logged('warn')).toContain('/posts/kept/ has no content, so its record is left as it is');
		expect(messages('log')).toContain(
			'[standard-site] Published: 0 created, 0 updated, 0 unchanged, 1 skipped'
		);
	});

	it("aren't published yet, or pinned", async () => {
		pds = fakePds();
		const d = { ...doc('empty', '', { pinned: false }), blocks: undefined };
		await run([d]);
		expect(recordOf(d)).toBeUndefined();
		expect(logged('warn')).toContain("/posts/empty/ has no content, so it isn't published yet");
		expect(fs.readFileSync(d.inputPath, 'utf8')).not.toContain('atUri');
	});
});

describe('images', () => {
	it('upload a cover image once, and reuse a blob the PDS already has', async () => {
		const cover = path.join(tmp.path, 'cover.png');
		fs.writeFileSync(cover, png());

		pds = fakePds();
		// two posts sharing a cover upload it once
		await run([doc('one', 'Hi.'), doc('two', 'Hi.')], { coverImage: () => cover });
		expect(pds.uploads).toBe(1);
		expect(recordOf(doc('one', 'Hi.'))!.coverImage).toEqual({
			$type: 'blob',
			ref: { $link: blobCid(png()) },
			mimeType: 'image/png',
			size: 32
		});
		expect(logged('log')).toContain('Uploaded cover.png');

		// a second run against the same PDS has nothing to upload or write
		pds.uploads = 0;
		pds.writes = [];
		await run([doc('one', 'Hi.')], { coverImage: () => cover });
		expect(pds.uploads).toBe(0);
		expect(pds.writes).toEqual([]);
	});

	it("skip a cover image that can't be used", async () => {
		fs.writeFileSync(path.join(tmp.path, 'cover.txt'), 'not an image');
		pds = fakePds();
		const d = doc('nocover', 'Hi.');
		const covers: Record<string, string> = {
			'/posts/nocover/': path.join(tmp.path, 'missing.png'),
			'/posts/textcover/': path.join(tmp.path, 'cover.txt')
		};
		await run([d, doc('textcover', 'Hi.'), doc('plain', 'Hi.')], {
			coverImage: (post) => covers[post.url]
		});
		expect(recordOf(d)).not.toHaveProperty('coverImage');
		expect(logged('warn')).toContain('/posts/nocover/: skipping cover image: ENOENT');
		expect(logged('warn')).toContain(
			"/posts/textcover/: skipping cover image: cover.txt isn't a PNG, JPEG, GIF, or WebP image"
		);
		expect(pds.uploads).toBe(0);
	});

	it('become image blocks, or a link when one can’t be used', async () => {
		fs.writeFileSync(path.join(tmp.path, 'pic.png'), png());
		fs.writeFileSync(path.join(tmp.path, 'notes.txt'), 'not an image');
		fs.writeFileSync(path.join(tmp.path, 'big.png'), png(10, 5, 1_000_001));
		fs.writeFileSync(path.join(tmp.path, 'edge.png'), png(3, 3, 1_000_000));
		pds = fakePds();
		const d = doc(
			'pics',
			[
				'![ok](/pic.png)',
				'![](pic.png)',
				'![edge](/edge.png)',
				'![missing](/nope.png)',
				'![text](/notes.txt)',
				'![big](/big.png)'
			].join('\n\n')
		);
		await run([d]);
		const blocks = blocksOf(d);
		expect(blocks[0]).toEqual({
			$type: IMAGE,
			image: { $type: 'blob', ref: { $link: blobCid(png()) }, mimeType: 'image/png', size: 32 },
			aspectRatio: { width: 10, height: 5 },
			alt: 'ok'
		});
		// relative to the post's own file, and without alt text when there's none
		expect(blocks[1].$type).toBe(IMAGE);
		expect(blocks[1]).not.toHaveProperty('alt');
		// a megabyte exactly is allowed
		expect(blocks[2]).toMatchObject({ $type: IMAGE, aspectRatio: { width: 3, height: 3 } });
		expect(pds.uploads).toBe(2);
		expect(blocks.slice(3).map((block) => [block.$type, block.plaintext])).toEqual([
			[TEXT, 'missing'],
			[TEXT, 'text'],
			[TEXT, 'big']
		]);
		expect(blocks[3].facets?.[0].features[0].uri).toBe('https://example.com/nope.png');
		const warnings = logged('warn');
		expect(warnings).toContain('/posts/pics/: using a link for /nope.png: ENOENT');
		expect(warnings).toContain("/notes.txt isn't a PNG, JPEG, GIF, or WebP image");
		expect(warnings).toContain('/big.png is 1000001 bytes, over the 1000000 byte blob limit');
	});

	it('are only uploaded when no record already references them', async () => {
		fs.writeFileSync(path.join(tmp.path, 'pic.png'), png());
		const blob = { $type: 'blob', ref: { $link: blobCid(png()) }, mimeType: 'image/png', size: 32 };
		const other = doc('other', 'Elsewhere.');
		pds = fakePds({
			records: {
				// another post's record holding the same image
				[keyOf(other)]: published(other, {
					content: toContent([{ $type: IMAGE, image: blob, aspectRatio: { width: 10, height: 5 } }])
				})
			}
		});
		const d = doc('reuse', '![pic](/pic.png)');
		await run([d, other]);
		expect(pds.uploads).toBe(0);
		expect(blocksOf(d)[0].image).toEqual(blob);
	});

	it('are fetched from the web', async () => {
		pds = fakePds({
			routes: {
				'https://cdn.example/pic.png': () => new Response(png(4, 3)),
				'https://cdn.example/gone.png': () => new Response('', { status: 404 })
			}
		});
		const d = doc(
			'remote',
			'![remote](https://cdn.example/pic.png)\n\n![gone](https://cdn.example/gone.png)'
		);
		await run([d]);
		const [image, fallback] = blocksOf(d);
		expect(image).toMatchObject({ $type: IMAGE, aspectRatio: { width: 4, height: 3 } });
		expect(fallback.plaintext).toBe('gone');
		expect(fallback.facets?.[0].features[0].uri).toBe('https://cdn.example/gone.png');
		expect(logged('warn')).toContain(
			'using a link for https://cdn.example/gone.png: 404 fetching https://cdn.example/gone.png'
		);
	});

	it('are fetched protocol-relative and from data: URLs, but not other schemes', async () => {
		pds = fakePds({
			routes: {
				'https://cdn.example/pic.png': () => new Response(png(4, 3)),
				'https://cdn.example/huge.png': () =>
					new Response(png(), { headers: { 'content-length': '2000000' } })
			}
		});
		const data = `data:image/png;base64,${png(7, 7).toString('base64')}`;
		const fake = vi.mocked(globalThis.fetch).getMockImplementation()!;
		vi.mocked(globalThis.fetch).mockImplementation((input, init) =>
			String(input).startsWith('data:')
				? Promise.resolve(new Response(Buffer.from(String(input).split(',')[1], 'base64')))
				: fake(input, init)
		);
		const d = doc(
			'schemes',
			[
				'![relative](//cdn.example/pic.png)',
				`![data](${data})`,
				'![ftp](ftp://files.example/pic.png)',
				'![huge](https://cdn.example/huge.png)'
			].join('\n\n')
		);
		await run([d]);
		const [relative, inline, ftp, huge] = blocksOf(d);
		expect(relative.aspectRatio).toEqual({ width: 4, height: 3 });
		expect(inline.aspectRatio).toEqual({ width: 7, height: 7 });
		expect(ftp.plaintext).toBe('ftp');
		expect(huge.plaintext).toBe('huge');
		expect(logged('warn')).toContain("can't fetch ftp://files.example/pic.png");
		expect(logged('warn')).toContain(
			'https://cdn.example/huge.png is over the 1000000 byte blob limit'
		);
	});

	it('are found when markdown-it percent-encoded their names', async () => {
		fs.mkdirSync(path.join(tmp.path, 'img'));
		for (const name of ['my pic.png', 'café.png', 'plain.png', '100%E0.png']) {
			fs.writeFileSync(path.join(tmp.path, 'img', name), png());
		}
		pds = fakePds();
		const d = doc(
			'encoded',
			[
				'![a](<img/my pic.png>)',
				'![b](/img/café.png)',
				'![c](img/plain.png?v=2#top)',
				// not valid percent-encoding, so read as it is
				'<img src="img/100%E0.png" alt="d">'
			].join('\n\n')
		);
		await run([d]);
		expect(blocksOf(d).map((block) => block.$type)).toEqual(Array(4).fill(IMAGE));
		expect(logged('warn')).toBe('');
	});

	it('are found where a shortcode wrote them, in the output directory', async () => {
		const output = path.join(tmp.path, '_site');
		fs.mkdirSync(path.join(output, 'img'), { recursive: true });
		fs.mkdirSync(path.join(output, 'posts', 'built'), { recursive: true });
		fs.writeFileSync(path.join(output, 'img', 'hash-640.png'), png(640, 480));
		fs.writeFileSync(path.join(output, 'posts', 'built', 'near.png'), png(2, 1));
		pds = fakePds();
		const d = doc('built', '<img src="/img/hash-640.png" alt="Generated">\n\n![near](near.png)');
		await run([d], { outputDir: output });
		const [generated, near] = blocksOf(d);
		expect(generated).toMatchObject({ aspectRatio: { width: 640, height: 480 }, alt: 'Generated' });
		expect(near.aspectRatio).toEqual({ width: 2, height: 1 });
	});

	it('are fetched and uploaded a few at a time, not all at once', async () => {
		let active = 0;
		let most = 0;
		const slow = (bytes: ReturnType<typeof png>) => async () => {
			active++;
			most = Math.max(most, active);
			await new Promise((resolve) => setTimeout(resolve, 5));
			active--;
			return new Response(bytes);
		};
		const routes: Record<string, () => Promise<Response>> = {};
		const posts: Document[] = [];
		for (let i = 0; i < 30; i++) {
			routes[`https://cdn.example/${i}.png`] = slow(png(i + 1, 1));
			posts.push(doc(`many${i}`, `![${i}](https://cdn.example/${i}.png)`));
		}
		pds = fakePds({ routes });
		await run(posts);
		expect(pds.uploads).toBe(30);
		expect(most).toBeGreaterThan(1);
		expect(most).toBeLessThanOrEqual(8);
	});
});

describe('Bluesky posts', () => {
	it('embed, and fall back to a link when one is gone', async () => {
		const post = 'at://did:plc:author/app.bsky.feed.post/3kpost';
		pds = fakePds({
			routes: {
				'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle': (url) =>
					json({ did: `did:plc:${url.searchParams.get('handle')!.split('.')[0]}` }),
				'https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts': (url) =>
					json({ posts: url.searchParams.get('uris') === post ? [{ uri: post, cid: CID }] : [] })
			}
		});
		const byHandle = 'https://bsky.app/profile/author.example/post/3kpost';
		const byDid = 'https://bsky.app/profile/did:plc:author/post/3kpost';
		const gone = 'https://bsky.app/profile/author.example/post/3kgone';
		const d = doc('embeds', [byHandle, byDid, gone].join('\n\n'));
		const again = doc('again', byHandle);
		// the same post in another doc is only looked up once
		await run([d, again]);

		const embed = { $type: 'pub.leaflet.blocks.bskyPost', postRef: { uri: post, cid: CID } };
		const [one, two, three] = blocksOf(d);
		expect(one).toEqual(embed);
		expect(two).toEqual(embed);
		expect(three).toEqual({
			$type: TEXT,
			plaintext: gone,
			facets: [
				{
					index: { byteStart: 0, byteEnd: gone.length },
					features: [{ $type: 'pub.leaflet.richtext.facet#link', uri: gone }]
				}
			]
		});
		expect(logged('warn')).toContain(`using a link for ${gone}: ${gone} wasn't found`);
		expect(blocksOf(again)).toEqual([embed]);

		const appview = pds.requests.filter((url) => url.startsWith('https://public.api.bsky.app/'));
		expect(appview.filter((url) => url.includes('resolveHandle'))).toHaveLength(2);
		expect(appview.filter((url) => url.includes('getPosts'))).toHaveLength(3);
	});
});

describe('limiter', () => {
	it('runs functions a few at a time and passes results and failures through', async () => {
		const limit = limiter(2);
		let active = 0;
		let most = 0;
		const task = (value: string) => async () => {
			active++;
			most = Math.max(most, active);
			await new Promise((resolve) => setImmediate(resolve));
			active--;
			if (value === 'fail') throw new Error('failed');
			return value;
		};
		const results = await Promise.allSettled(
			['a', 'b', 'fail', 'c'].map((value) => limit(task(value)))
		);
		expect(
			results.map((result) =>
				result.status === 'fulfilled' ? result.value : result.reason.message
			)
		).toEqual(['a', 'b', 'failed', 'c']);
		expect(most).toBe(2);
		// a function that throws before returning a promise is a failure too
		await expect(
			limit(() => {
				throw new Error('sync');
			})
		).rejects.toThrow('sync');
		// and a plain value is a result
		await expect(limit(() => 42)).resolves.toBe(42);
	});
});

describe('localPaths', () => {
	const post = { inputPath: '/site/posts/hello.md', url: '/posts/hello/' };

	it('looks for a /-rooted src in the input, then the output directory', () => {
		expect(localPaths('/img/a.png', post, { inputDir: '/site', outputDir: '/site/_site' })).toEqual(
			['/site/img/a.png', '/site/_site/img/a.png']
		);
	});

	it('looks for a relative src next to the post, then next to its page', () => {
		expect(localPaths('a.png', post, { inputDir: '/site', outputDir: '/site/_site' })).toEqual([
			'/site/posts/a.png',
			'/site/_site/posts/hello/a.png'
		]);
		expect(localPaths('../b.png', post, { inputDir: '/site' })).toEqual(['/site/b.png']);
	});

	it('decodes the src, without its query or fragment', () => {
		expect(localPaths('my%20pic.png?v=2#top', post, { inputDir: '/site' })).toEqual([
			'/site/posts/my pic.png'
		]);
		expect(localPaths('100%E0.png', post, { inputDir: '/site' })).toEqual([
			'/site/posts/100%E0.png'
		]);
	});
});
