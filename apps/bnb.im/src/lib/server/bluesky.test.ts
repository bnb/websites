import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Thread } from './bluesky';
import {
	clearThreads,
	embedBlueskyPosts,
	fetchThread,
	renderPost,
	renderRichText
} from './bluesky';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const NOT_FOUND_ERROR = /^400 NotFound$/;
const BAD_GATEWAY = /^502$/;
const RATE_LIMITED = /^429 RateLimitExceeded$/;
const MEDIA_THEN_QUOTE =
	/<p class="bsky-embed-text">Hello<\/p><a class="bsky-embed-external" href="https:\/\/example\.com">.*<\/a><div class="bsky-embed-quote">.*Quoted words.*<\/div><footer/;

type PostView = Thread['post'];
type Author = PostView['author'];
type Embed = NonNullable<PostView['embed']>;
type Facet = NonNullable<Parameters<typeof renderRichText>[1]>[number];
type QuotedRecord = Extract<Embed, { $type: 'app.bsky.embed.record#view' }>['record'];

const FIXTURES = path.join(import.meta.dirname, 'fixtures', 'bluesky');
const fixture = (name: string): { fetchedAt: number; thread: Thread } =>
	JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));

const CREATED = '2026-10-02T17:42:11.737Z';
const HREF = 'https://bsky.app/profile/alice.test/post/3abc';

function author(extra: Partial<Author> = {}): Author {
	return {
		did: 'did:plc:alice',
		handle: 'alice.test',
		displayName: 'Alice',
		avatar: 'https://cdn.test/alice.jpg',
		...extra
	};
}

function postView(extra: Partial<PostView> = {}): PostView {
	return {
		uri: 'at://did:plc:alice/app.bsky.feed.post/3abc',
		author: author(),
		record: { text: 'Hello', createdAt: CREATED },
		...extra
	};
}

function thread(extra: Partial<PostView> = {}, parent?: Thread['parent']): Thread {
	return { $type: 'app.bsky.feed.defs#threadViewPost', post: postView(extra), parent };
}

const withEmbed = (embed: Embed, extra: Partial<PostView> = {}) =>
	renderPost(thread({ embed, ...extra }))!;

function quoted(extra: Record<string, unknown> = {}): QuotedRecord {
	return {
		$type: 'app.bsky.embed.record#viewRecord',
		uri: 'at://did:plc:bob/app.bsky.feed.post/3quote',
		author: { did: 'did:plc:bob', handle: 'bob.test', displayName: 'Bob' },
		value: { text: 'Quoted words', createdAt: '2025-01-05T10:00:00.000Z' },
		...extra
	} as QuotedRecord;
}

const image = (n: number, aspectRatio?: { width: number; height: number }) => ({
	thumb: `https://cdn.test/thumb/${n}.jpg`,
	fullsize: `https://cdn.test/full/${n}.jpg`,
	alt: `Photo ${n}`,
	aspectRatio
});

describe('renderRichText', () => {
	const link = (byteStart: number, byteEnd: number, uri: string): Facet => ({
		index: { byteStart, byteEnd },
		features: [{ $type: 'app.bsky.richtext.facet#link', uri }]
	});

	it('escapes plain text', () => {
		expect(renderRichText(`<b>Tom & "Jerry's"</b>`)).toBe(
			'&lt;b&gt;Tom &amp; &quot;Jerry&#39;s&quot;&lt;/b&gt;'
		);
		expect(renderRichText()).toBe('');
	});

	it('links facets by their UTF-8 byte offsets, emoji included', () => {
		// 🦋 is four bytes and two UTF-16 code units, so string offsets would be wrong
		const text = '🦋 see example.com now';
		expect(renderRichText(text, [link(9, 20, 'https://example.com')])).toBe(
			'🦋 see <a href="https://example.com">example.com</a> now'
		);
	});

	it('links mentions to the profile and tags to the hashtag page', () => {
		const text = 'hi @bob.test #c++ #';
		expect(
			renderRichText(text, [
				{
					index: { byteStart: 13, byteEnd: 17 },
					features: [{ $type: 'app.bsky.richtext.facet#tag', tag: 'c++' }]
				},
				{
					index: { byteStart: 3, byteEnd: 12 },
					features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:bob' }]
				},
				{
					index: { byteStart: 18, byteEnd: 19 },
					features: [{ $type: 'app.bsky.richtext.facet#tag' }]
				}
			])
		).toBe(
			'hi <a href="https://bsky.app/profile/did:plc:bob">@bob.test</a> ' +
				'<a href="https://bsky.app/hashtag/c%2B%2B">#c++</a> ' +
				'<a href="https://bsky.app/hashtag/">#</a>'
		);
	});

	it('escapes the text and the URL of a link', () => {
		expect(renderRichText('a <link> b', [link(2, 8, 'https://example.com/?q="x"&y')])).toBe(
			'a <a href="https://example.com/?q=&quot;x&quot;&amp;y">&lt;link&gt;</a> b'
		);
	});

	it("doesn't link anything but http(s) URLs", () => {
		expect(renderRichText('click me', [link(0, 5, 'javascript:alert(1)')])).toBe('click me');
		expect(
			renderRichText('click me', [
				{
					index: { byteStart: 0, byteEnd: 5 },
					features: [{ $type: 'app.bsky.richtext.facet#link' }]
				}
			])
		).toBe('click me');
		expect(renderRichText('click me', [link(0, 5, 'HTTPS://EXAMPLE.COM')])).toBe(
			'<a href="HTTPS://EXAMPLE.COM">click</a> me'
		);
	});

	it('falls through to the next feature when one is unusable', () => {
		const facet: Facet = {
			index: { byteStart: 0, byteEnd: 5 },
			features: [
				{ $type: 'app.bsky.richtext.facet#link', uri: 'ftp://example.com' },
				{ $type: 'app.bsky.richtext.facet#unknown' },
				{ $type: 'app.bsky.richtext.facet#tag', tag: 'hello' }
			]
		};
		expect(renderRichText('hello world', [facet])).toBe(
			'<a href="https://bsky.app/hashtag/hello">hello</a> world'
		);
	});

	it('skips overlapping, empty, out-of-range, unindexed and featureless facets', () => {
		const text = 'one two three';
		expect(
			renderRichText(text, [
				link(0, 7, 'https://a.test'),
				// overlaps the first
				link(4, 7, 'https://b.test'),
				// empty and backwards
				link(8, 8, 'https://c.test'),
				link(10, 9, 'https://d.test'),
				// past the end
				link(8, 99, 'https://e.test'),
				{ features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://f.test' }] },
				{ index: { byteStart: 8, byteEnd: 13 }, features: [] },
				{ index: { byteStart: 8, byteEnd: 13 } } as Facet
			])
		).toBe('<a href="https://a.test">one two</a> three');
	});
});

describe('renderPost', () => {
	it('renders a post as a static blockquote', () => {
		const html = renderPost(thread())!;
		const start =
			`<blockquote class="bsky-embed" cite="${HREF}">` +
			'<div class="bsky-embed-header">' +
			'<a class="bsky-embed-author" href="https://bsky.app/profile/alice.test">' +
			'<img class="bsky-embed-avatar" src="https://cdn.test/alice.jpg" alt="" width="44" height="44" loading="lazy">' +
			'<span class="bsky-embed-names"><strong class="bsky-embed-name">Alice</strong>' +
			'<span class="bsky-embed-handle">@alice.test</span></span></a>' +
			`<a class="bsky-embed-logo" href="${HREF}" aria-label="View on Bluesky"><svg viewBox="0 0 600 530"`;
		expect(html.slice(0, start.length)).toBe(start);
	});

	it('ends with the date and a link to the post', () => {
		const html = renderPost(thread())!;
		const end =
			'</svg></a></div><p class="bsky-embed-text">Hello</p>' +
			'<footer class="bsky-embed-footer">' +
			`<a href="${HREF}"><time datetime="${CREATED}">02 Oct 2026</time></a>` +
			`<a href="${HREF}">View on Bluesky</a></footer></blockquote>`;
		expect(html.slice(-end.length)).toBe(end);
	});

	it('uses a placeholder without an avatar, and the handle without a display name', () => {
		const html = renderPost(
			thread({ author: author({ avatar: undefined, displayName: undefined }) })
		)!;
		expect(html).toContain('<span class="bsky-embed-avatar"></span>');
		expect(html).not.toContain('<img class="bsky-embed-avatar"');
		expect(html).toContain('<strong class="bsky-embed-name">alice.test</strong>');
	});

	it('links by DID when the handle is invalid', () => {
		const html = renderPost(thread({ author: author({ handle: 'handle.invalid' }) }))!;
		expect(html).toContain('cite="https://bsky.app/profile/did:plc:alice/post/3abc"');
		expect(html).toContain('href="https://bsky.app/profile/did:plc:alice"');
		expect(html).toContain('<span class="bsky-embed-handle">@handle.invalid</span>');
	});

	it('leaves out the text paragraph for a post without text', () => {
		const html = renderPost(thread({ record: { createdAt: CREATED } }))!;
		expect(html).not.toContain('bsky-embed-text');
	});

	it('renders rich text in the post', () => {
		const html = renderPost(
			thread({
				record: {
					text: 'with @bob.test',
					createdAt: CREATED,
					facets: [
						{
							index: { byteStart: 5, byteEnd: 14 },
							features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:bob' }]
						}
					]
				}
			})
		)!;
		expect(html).toContain(
			'<p class="bsky-embed-text">with <a href="https://bsky.app/profile/did:plc:bob">@bob.test</a></p>'
		);
	});

	describe('reply context', () => {
		it('names who the post replies to', () => {
			const parent = {
				post: postView({ author: author({ did: 'did:plc:bob', handle: 'bob.test' }) })
			};
			expect(renderPost(thread({}, parent))).toContain(
				'</div><p class="bsky-embed-context">Replying to <a href="https://bsky.app/profile/bob.test">@bob.test</a></p>'
			);
		});

		it('leaves it out when the parent author opted out, or the parent is unavailable', () => {
			const optedOut = {
				post: postView({
					author: author({ handle: 'bob.test', labels: [{ val: '!no-unauthenticated' }] })
				})
			};
			expect(renderPost(thread({}, optedOut))).not.toContain('bsky-embed-context');
			expect(renderPost(thread({}, {}))).not.toContain('bsky-embed-context');
		});
	});

	describe('media', () => {
		it.each([1, 2, 3])('lays out %i images', (count) => {
			const images = Array.from({ length: count }, (_, i) => image(i + 1));
			const html = withEmbed({ $type: 'app.bsky.embed.images#view', images });
			expect(html).toContain(`<div class="bsky-embed-images" data-count="${count}">`);
			expect(html.match(/<img src="https:\/\/cdn\.test\/thumb\//g)).toHaveLength(count);
		});

		it('links each image to its full size, sized by its aspect ratio when known', () => {
			const html = withEmbed({
				$type: 'app.bsky.embed.images#view',
				images: [
					image(1, { width: 1600, height: 900 }),
					{ ...image(2, { width: 0, height: 900 }), alt: 'A "quoted" <alt>' }
				]
			});
			expect(html).toContain(
				'<a href="https://cdn.test/full/1.jpg"><img src="https://cdn.test/thumb/1.jpg" alt="Photo 1" width="1600" height="900" loading="lazy"></a>'
			);
			expect(html).toContain(
				'<a href="https://cdn.test/full/2.jpg"><img src="https://cdn.test/thumb/2.jpg" alt="A &quot;quoted&quot; &lt;alt&gt;" loading="lazy"></a>'
			);
		});

		it('renders a gallery as a strip, linking to the post when there is no full size', () => {
			const html = withEmbed({
				$type: 'app.bsky.embed.gallery#view',
				items: [
					{
						thumbnail: 'https://cdn.test/g1.jpg',
						fullsize: 'https://cdn.test/g1-full.jpg',
						alt: 'First',
						aspectRatio: { width: 4, height: 3 }
					},
					{ thumbnail: 'https://cdn.test/g2.jpg', alt: 'Second' }
				]
			});
			expect(html).toContain(
				'<div class="bsky-embed-gallery">' +
					'<a href="https://cdn.test/g1-full.jpg"><img src="https://cdn.test/g1.jpg" alt="First" width="4" height="3" loading="lazy"></a>' +
					`<a href="${HREF}"><img src="https://cdn.test/g2.jpg" alt="Second" loading="lazy"></a>` +
					'</div>'
			);
		});

		it('links a video poster to the post instead of playing it', () => {
			expect(
				withEmbed({
					$type: 'app.bsky.embed.video#view',
					thumbnail: 'https://video.test/poster.jpg',
					alt: 'A demo'
				})
			).toContain(
				`<a class="bsky-embed-video" href="${HREF}" aria-label="Watch video on Bluesky">` +
					'<img src="https://video.test/poster.jpg" alt="A demo" loading="lazy">' +
					'<span class="bsky-embed-play" aria-hidden="true"></span></a>'
			);
			expect(
				withEmbed({ $type: 'app.bsky.embed.video#view', thumbnail: 'https://video.test/p.jpg' })
			).toContain('<img src="https://video.test/p.jpg" alt="" loading="lazy">');
		});

		it('renders a link card with its domain, title, description and thumbnail', () => {
			expect(
				withEmbed({
					$type: 'app.bsky.embed.external#view',
					external: {
						uri: 'https://www.example.com/post',
						title: 'A post',
						description: 'All about it',
						thumb: 'https://cdn.test/card.jpg'
					}
				})
			).toContain(
				'<a class="bsky-embed-external" href="https://www.example.com/post">' +
					'<img src="https://cdn.test/card.jpg" alt="" loading="lazy">' +
					'<span class="bsky-embed-external-body">' +
					'<span class="bsky-embed-external-domain">example.com</span>' +
					'<strong>A post</strong>' +
					'<span class="bsky-embed-external-description">All about it</span>' +
					'</span></a>'
			);
		});

		it('falls back to the URL for a link card without a title, thumbnail or description', () => {
			expect(
				withEmbed({ $type: 'app.bsky.embed.external#view', external: { uri: 'http://a.test/x' } })
			).toContain(
				'<a class="bsky-embed-external" href="http://a.test/x"><span class="bsky-embed-external-body">' +
					'<span class="bsky-embed-external-domain">a.test</span><strong>http://a.test/x</strong></span></a>'
			);
		});

		it('drops a link card that is not http(s)', () => {
			const html = withEmbed({
				$type: 'app.bsky.embed.external#view',
				external: { uri: 'javascript:alert(1)', title: 'Nope' }
			});
			expect(html).not.toContain('bsky-embed-external');
			expect(html).not.toContain('Nope');
		});

		it('ignores an embed type it does not know', () => {
			const html = withEmbed({ $type: 'app.bsky.embed.mystery#view' } as unknown as Embed);
			expect(html).toContain('<p class="bsky-embed-text">Hello</p><footer');
		});

		it('hides media on a post labelled sensitive', () => {
			const html = withEmbed(
				{ $type: 'app.bsky.embed.images#view', images: [image(1)] },
				{ labels: [{ val: 'graphic-media' }] }
			);
			expect(html).toContain(
				`<a class="bsky-embed-notice" href="${HREF}">Media hidden: sensitive content. View on Bluesky.</a>`
			);
			expect(html).not.toContain('bsky-embed-images');
		});

		it('shows media on a post with other labels', () => {
			const html = withEmbed(
				{ $type: 'app.bsky.embed.images#view', images: [image(1)] },
				{ labels: [{ val: 'spam' }] }
			);
			expect(html).toContain('bsky-embed-images');
		});
	});

	describe('quotes', () => {
		const quoting = (record: QuotedRecord) =>
			withEmbed({ $type: 'app.bsky.embed.record#view', record });

		it('renders the quoted post with its author, date and text', () => {
			expect(
				quoting(
					quoted({
						author: {
							did: 'did:plc:bob',
							handle: 'bob.test',
							displayName: 'Bob',
							avatar: 'https://cdn.test/bob.jpg'
						}
					})
				)
			).toContain(
				'<div class="bsky-embed-quote">' +
					'<a class="bsky-embed-quote-header" href="https://bsky.app/profile/bob.test/post/3quote">' +
					'<img class="bsky-embed-avatar" src="https://cdn.test/bob.jpg" alt="" width="20" height="20" loading="lazy">' +
					'<strong class="bsky-embed-name">Bob</strong>' +
					'<span class="bsky-embed-handle">@bob.test · <time datetime="2025-01-05T10:00:00.000Z">05 Jan 2025</time></span></a>' +
					'<p class="bsky-embed-text">Quoted words</p>' +
					'</div>'
			);
		});

		it('renders a quoted post without avatar, display name or text', () => {
			const html = quoting(
				quoted({
					author: { did: 'did:plc:bob', handle: 'bob.test' },
					value: { createdAt: '2025-01-05T10:00:00.000Z' }
				})
			);
			expect(html).toContain(
				'<a class="bsky-embed-quote-header" href="https://bsky.app/profile/bob.test/post/3quote">' +
					'<strong class="bsky-embed-name">bob.test</strong>'
			);
			expect(html).toContain('</time></span></a></div>');
		});

		it("renders the quoted post's media", () => {
			const html = quoting(
				quoted({ embeds: [{ $type: 'app.bsky.embed.images#view', images: [image(7)] }] })
			);
			expect(html).toContain(
				'<p class="bsky-embed-text">Quoted words</p><div class="bsky-embed-images" data-count="1">'
			);
		});

		it('renders the media of a quoted post that itself quotes, but not the inner quote', () => {
			const html = quoting(
				quoted({
					embeds: [
						{
							$type: 'app.bsky.embed.recordWithMedia#view',
							media: { $type: 'app.bsky.embed.images#view', images: [image(8)] },
							record: { record: quoted({ uri: 'at://did:plc:carol/app.bsky.feed.post/3inner' }) }
						}
					]
				})
			);
			expect(html).toContain('https://cdn.test/thumb/8.jpg');
			expect(html).not.toContain('3inner');
		});

		it('respects a quoted author who opted out of external sites', () => {
			const html = quoting(
				quoted({
					author: {
						did: 'did:plc:bob',
						handle: 'bob.test',
						labels: [{ val: '!no-unauthenticated' }]
					}
				})
			);
			expect(html).toContain(
				'<a class="bsky-embed-notice" href="https://bsky.app/profile/bob.test/post/3quote">' +
					'The author of the quoted post has requested their posts not be displayed on external sites.</a>'
			);
			expect(html).not.toContain('Quoted words');
		});

		it('respects a quoted post labelled to opt out', () => {
			const html = quoting(quoted({ labels: [{ val: '!no-unauthenticated' }] }));
			expect(html).toContain('The author of the quoted post has requested');
		});

		it('hides the media of a sensitive quoted post', () => {
			const html = quoting(
				quoted({
					labels: [{ val: 'porn' }],
					embeds: [{ $type: 'app.bsky.embed.images#view', images: [image(9)] }]
				})
			);
			expect(html).toContain(
				'<p class="bsky-embed-text">Quoted words</p>' +
					'<a class="bsky-embed-notice" href="https://bsky.app/profile/bob.test/post/3quote">Media hidden: sensitive content. View on Bluesky.</a></div>'
			);
			expect(html).not.toContain('thumb/9.jpg');
		});

		it.each([
			['app.bsky.embed.record#viewNotFound', 'Quoted post not found, it may have been deleted.'],
			['app.bsky.embed.record#viewBlocked', 'Quoted post is unavailable.'],
			['app.bsky.embed.record#viewDetached', 'Quoted post removed by its author.']
		])('explains a %s quote', ($type, message) => {
			const html = quoting({ $type, uri: 'at://x/app.bsky.feed.post/1' } as QuotedRecord);
			expect(html).toContain(`<p class="bsky-embed-notice">${message}</p>`);
		});

		it('renders a quoted feed as a card', () => {
			expect(
				quoting({
					$type: 'app.bsky.feed.defs#generatorView',
					uri: 'at://did:plc:bob/app.bsky.feed.generator/whats-hot',
					displayName: "What's Hot",
					creator: { did: 'did:plc:bob', handle: 'bob.test' }
				})
			).toContain(
				'<a class="bsky-embed-external" href="https://bsky.app/profile/bob.test/feed/whats-hot">' +
					'<span class="bsky-embed-external-body"><strong>What&#39;s Hot</strong>' +
					'<span class="bsky-embed-external-domain">Feed by @bob.test</span></span></a>'
			);
		});

		it('renders a quoted list as a card', () => {
			expect(
				quoting({
					$type: 'app.bsky.graph.defs#listView',
					uri: 'at://did:plc:bob/app.bsky.graph.list/3list',
					name: 'Friends',
					creator: { did: 'did:plc:bob', handle: 'handle.invalid' }
				})
			).toContain(
				'<a class="bsky-embed-external" href="https://bsky.app/profile/did:plc:bob/lists/3list">' +
					'<span class="bsky-embed-external-body"><strong>Friends</strong>' +
					'<span class="bsky-embed-external-domain">List by @handle.invalid</span></span></a>'
			);
		});

		it('renders a quoted starter pack as a card', () => {
			expect(
				quoting({
					$type: 'app.bsky.graph.defs#starterPackViewBasic',
					uri: 'at://did:plc:bob/app.bsky.graph.starterpack/3pack',
					record: { name: 'Atmosphere folks' },
					creator: { did: 'did:plc:bob', handle: 'bob.test' }
				})
			).toContain(
				'<a class="bsky-embed-external" href="https://bsky.app/starter-pack/bob.test/3pack">' +
					'<span class="bsky-embed-external-body"><strong>Atmosphere folks</strong>' +
					'<span class="bsky-embed-external-domain">Starter pack by @bob.test</span></span></a>'
			);
		});

		it('renders nothing for a record type it does not know', () => {
			const html = quoting({
				$type: 'app.bsky.labeler.defs#labelerView'
			} as unknown as QuotedRecord);
			expect(html).toContain('<p class="bsky-embed-text">Hello</p><footer');
		});

		it('renders media alongside a quote', () => {
			const html = withEmbed({
				$type: 'app.bsky.embed.recordWithMedia#view',
				media: {
					$type: 'app.bsky.embed.external#view',
					external: { uri: 'https://example.com', title: 'Example' }
				},
				record: { record: quoted() }
			});
			expect(html).toMatch(MEDIA_THEN_QUOTE);
		});
	});

	describe('posts that are not embedded', () => {
		it('returns null when the author opted out of external sites', () => {
			expect(
				renderPost(thread({ author: author({ labels: [{ val: '!no-unauthenticated' }] }) }))
			).toBeNull();
		});

		it('returns null when the post is labelled to opt out', () => {
			expect(renderPost(thread({ labels: [{ val: '!no-unauthenticated' }] }))).toBeNull();
		});

		it('returns null for anything but a thread view of a post', () => {
			expect(
				renderPost({ ...thread(), $type: 'app.bsky.feed.defs#notFoundPost' } as Thread)
			).toBeNull();
			expect(renderPost({ ...thread(), $type: 'app.bsky.feed.defs#blockedPost' })).toBeNull();
			expect(renderPost(undefined)).toBeNull();
		});
	});

	describe('real threads', () => {
		it('renders the post quoted in "What is the Atmosphere", whose quoted author opted out', () => {
			const html = renderPost(fixture('bnb.im-3mwvwapoefs26').thread)!;
			expect(html).toContain('cite="https://bsky.app/profile/bnb.im/post/3mwvwapoefs26"');
			expect(html).toContain('<strong class="bsky-embed-name">tierney cyren</strong>');
			expect(html).toContain('think about it like an email account');
			expect(html).toContain(
				'<a class="bsky-embed-notice" href="https://bsky.app/profile/eliasisquith.blog/post/3mwvuyiau3s2k">'
			);
			expect(html).not.toContain('i dont understand tech');
			expect(html).toContain('<time datetime="2026-10-02T17:42:11.737Z">02 Oct 2026</time>');
		});

		it('renders a reply with a mention', () => {
			const html = renderPost(fixture('bnb.im-3mwvyorvg5c26').thread)!;
			expect(html).toContain(
				'<p class="bsky-embed-context">Replying to <a href="https://bsky.app/profile/billthepony.bsky.social">@billthepony.bsky.social</a></p>'
			);
			expect(html).toContain(
				'<p class="bsky-embed-text">yes, with <a href="https://bsky.app/profile/did:plc:rbvrr34edl5ddpuwcubjiost">@stream.place</a>'
			);
		});
	});
});

// ── fetching ────────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-10-04T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const API =
	'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at%3A%2F%2Falice.test%2Fapp.bsky.feed.post%2F3abc&depth=0&parentHeight=1';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let cacheDir: string;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bnb-bluesky-'));
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	clearThreads();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	fs.rmSync(cacheDir, { recursive: true, force: true });
});

const cachePath = (name = 'alice.test-3abc') => path.join(cacheDir, `${name}.json`);
const writeCache = (fetchedAt: number, cached: Thread, name?: string) =>
	fs.writeFileSync(cachePath(name), JSON.stringify({ fetchedAt, thread: cached }));
const readCache = (name?: string) => JSON.parse(fs.readFileSync(cachePath(name), 'utf8'));

describe('fetchThread', () => {
	const cached = thread({ record: { text: 'cached', createdAt: CREATED } });
	const fresh = thread({ record: { text: 'fresh', createdAt: CREATED } });

	it('fetches the post and its parent from the public AppView, and caches it', async () => {
		const fetch = vi.fn(async () => json({ thread: fresh }));
		const result = await fetchThread('alice.test', '3abc', { fetch, cacheDir, now: () => NOW });

		expect(result).toEqual(fresh);
		expect(fetch).toHaveBeenCalledExactlyOnceWith(API);
		expect(readCache()).toEqual({ fetchedAt: NOW, thread: fresh });
	});

	it('creates the cache directory', async () => {
		const nested = path.join(cacheDir, 'a', 'b');
		await fetchThread('alice.test', '3abc', {
			fetch: async () => json({ thread: fresh }),
			cacheDir: nested,
			now: () => NOW
		});
		expect(fs.existsSync(path.join(nested, 'alice.test-3abc.json'))).toBe(true);
	});

	it('names cache files safely after the actor', async () => {
		await fetchThread('did:plc:alice', '3abc', {
			fetch: async () => json({ thread: fresh }),
			cacheDir,
			now: () => NOW
		});
		expect(fs.readdirSync(cacheDir)).toEqual(['did_plc_alice-3abc.json']);
	});

	it('uses a cached copy less than a day old without fetching', async () => {
		writeCache(NOW - DAY + 1000, cached);
		const fetch = vi.fn();
		const result = await fetchThread('alice.test', '3abc', { fetch, cacheDir, now: () => NOW });

		expect(result).toEqual(cached);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('refetches a day-old copy and rewrites the cache', async () => {
		writeCache(NOW - DAY, cached);
		const fetch = vi.fn(async () => json({ thread: fresh }));
		const result = await fetchThread('alice.test', '3abc', { fetch, cacheDir, now: () => NOW });

		expect(result).toEqual(fresh);
		expect(fetch).toHaveBeenCalledOnce();
		expect(readCache()).toEqual({ fetchedAt: NOW, thread: fresh });
	});

	it('falls back to a stale copy when the network is down', async () => {
		writeCache(NOW - 2 * DAY, cached);
		const result = await fetchThread('alice.test', '3abc', {
			fetch: async () => {
				throw new Error('getaddrinfo ENOTFOUND');
			},
			cacheDir,
			now: () => NOW
		});

		expect(result).toEqual(cached);
		expect(warn).toHaveBeenCalledWith(
			'[bluesky-embed] Fetching alice.test/3abc failed, using cached copy: getaddrinfo ENOTFOUND'
		);
		expect(readCache().fetchedAt).toBe(NOW - 2 * DAY);
	});

	it('falls back to a stale copy when the API errors', async () => {
		writeCache(NOW - 2 * DAY, cached);
		const result = await fetchThread('alice.test', '3abc', {
			fetch: async () => json({ error: 'InternalServerError' }, 502),
			cacheDir,
			now: () => NOW
		});

		expect(result).toEqual(cached);
		expect(warn).toHaveBeenCalledWith(
			'[bluesky-embed] Fetching alice.test/3abc failed, using cached copy: 502'
		);
	});

	it('forgets a post the API says is gone, and throws', async () => {
		writeCache(NOW - 2 * DAY, cached);
		await expect(
			fetchThread('alice.test', '3abc', {
				fetch: async () =>
					json({ error: 'NotFound', message: 'Post not found: at://alice.test/3abc' }, 400),
				cacheDir,
				now: () => NOW
			})
		).rejects.toThrow('400 Post not found: at://alice.test/3abc');
		expect(fs.existsSync(cachePath())).toBe(false);
	});

	it('throws when the network is down and nothing is cached', async () => {
		await expect(
			fetchThread('alice.test', '3abc', {
				fetch: async () => {
					throw new Error('offline');
				},
				cacheDir,
				now: () => NOW
			})
		).rejects.toThrow('offline');
	});

	it('throws when the API errors and nothing is cached', async () => {
		const options = { cacheDir, now: () => NOW };
		await expect(
			fetchThread('alice.test', '3abc', {
				...options,
				fetch: async () => json({ error: 'RateLimitExceeded' }, 429)
			})
		).rejects.toThrow(RATE_LIMITED);
		await expect(
			fetchThread('alice.test', '3abc', {
				...options,
				fetch: async () => new Response('<html>Bad gateway</html>', { status: 502 })
			})
		).rejects.toThrow(BAD_GATEWAY);
		await expect(
			fetchThread('alice.test', '3abc', {
				...options,
				fetch: async () => json({ error: 'NotFound' }, 400)
			})
		).rejects.toThrow(NOT_FOUND_ERROR);
		expect(fs.readdirSync(cacheDir)).toEqual([]);
	});

	it('defaults to the global fetch, the clock and .cache/bluesky in the working directory', async () => {
		const fetch = vi.fn(async () => json({ thread: fresh }));
		vi.stubGlobal('fetch', fetch);
		vi.spyOn(process, 'cwd').mockReturnValue(cacheDir);
		const before = Date.now();

		expect(await fetchThread('alice.test', '3abc')).toEqual(fresh);
		expect(fetch).toHaveBeenCalledExactlyOnceWith(API);
		const written = JSON.parse(
			fs.readFileSync(path.join(cacheDir, '.cache', 'bluesky', 'alice.test-3abc.json'), 'utf8')
		);
		expect(written.fetchedAt).toBeGreaterThanOrEqual(before);
		expect(written.fetchedAt).toBeLessThanOrEqual(Date.now());
	});
});

describe('embedBlueskyPosts', () => {
	const URL_A = 'https://bsky.app/profile/alice.test/post/3abc';
	const URL_B = 'https://bsky.app/profile/bob.test/post/3def';
	const standalone = (url: string, text = url) => `<p><a href="${url}">${text}</a></p>`;

	function api(threads: Record<string, Thread | Error>) {
		return vi.fn(async (input: string | URL | Request) => {
			const uri = new URL(String(input)).searchParams.get('uri')!;
			const result = threads[uri];
			if (!result) return json({ error: 'NotFound', message: `no ${uri}` }, 400);
			if (result instanceof Error) throw result;
			return json({ thread: result });
		});
	}

	const alice = thread();
	const bob = thread({
		uri: 'at://did:plc:bob/app.bsky.feed.post/3def',
		author: author({ did: 'did:plc:bob', handle: 'bob.test', displayName: 'Bob' })
	});

	it('replaces a standalone post link with an embed', async () => {
		const fetch = api({ 'at://alice.test/app.bsky.feed.post/3abc': alice });
		const html = await embedBlueskyPosts(`<h2>Before</h2>\n${standalone(URL_A)}\n<p>After</p>`, {
			fetch,
			cacheDir,
			now: () => NOW
		});

		expect(html).toBe(`<h2>Before</h2>\n${renderPost(alice)}\n<p>After</p>`);
		expect(fetch).toHaveBeenCalledOnce();
	});

	it('allows a trailing slash and whitespace around the link', async () => {
		const fetch = api({ 'at://alice.test/app.bsky.feed.post/3abc': alice });
		const html = await embedBlueskyPosts(`<p>\n  <a href="${URL_A}/">${URL_A}/</a>\n</p>`, {
			fetch,
			cacheDir,
			now: () => NOW
		});
		expect(html).toBe(renderPost(alice));
	});

	it('leaves links with their own text, inline links and other sites alone', async () => {
		const fetch = vi.fn();
		const input = [
			standalone(URL_A, 'my post on Bluesky'),
			`<p>See <a href="${URL_A}">${URL_A}</a> for more.</p>`,
			standalone('https://bsky.app/profile/alice.test'),
			standalone('https://example.com/profile/alice.test/post/3abc')
		].join('\n');

		const html = await embedBlueskyPosts(input, { fetch, cacheDir, now: () => NOW });
		expect(html).toBe(input);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("keeps the link when the post can't be shown on external sites", async () => {
		const optedOut = thread({ author: author({ labels: [{ val: '!no-unauthenticated' }] }) });
		const html = await embedBlueskyPosts(standalone(URL_A), {
			fetch: api({ 'at://alice.test/app.bsky.feed.post/3abc': optedOut }),
			cacheDir,
			now: () => NOW
		});

		expect(html).toBe(standalone(URL_A));
		expect(warn).toHaveBeenCalledWith(
			`[bluesky-embed] ${URL_A} can't be shown on external sites, leaving it as a link`
		);
	});

	it('keeps the link when fetching fails', async () => {
		const html = await embedBlueskyPosts(standalone(URL_A), {
			fetch: api({ 'at://alice.test/app.bsky.feed.post/3abc': new Error('offline') }),
			cacheDir,
			now: () => NOW
		});

		expect(html).toBe(standalone(URL_A));
		expect(warn).toHaveBeenCalledWith(
			`[bluesky-embed] Couldn't embed ${URL_A}, leaving it as a link: offline`
		);
	});

	it('embeds each post where it appears, even when another fails', async () => {
		const html = await embedBlueskyPosts(
			[standalone(URL_A), '<p>between</p>', standalone(URL_B)].join('\n'),
			{
				fetch: api({ 'at://bob.test/app.bsky.feed.post/3def': bob }),
				cacheDir,
				now: () => NOW
			}
		);
		expect(html).toBe([standalone(URL_A), '<p>between</p>', renderPost(bob)].join('\n'));
	});

	it('fetches a post linked more than once only once', async () => {
		const fetch = api({ 'at://alice.test/app.bsky.feed.post/3abc': alice });
		const options = { fetch, cacheDir, now: () => NOW };
		const html = await embedBlueskyPosts(`${standalone(URL_A)}\n${standalone(URL_A)}`, options);

		expect(html).toBe(`${renderPost(alice)}\n${renderPost(alice)}`);
		// across pages too
		await embedBlueskyPosts(standalone(URL_A), options);
		expect(fetch).toHaveBeenCalledOnce();
	});

	it('fetches again after clearThreads()', async () => {
		const fetch = api({ 'at://alice.test/app.bsky.feed.post/3abc': alice });
		await embedBlueskyPosts(standalone(URL_A), { fetch, cacheDir, now: () => NOW });
		clearThreads();
		// a day later, so the copy on disk is stale too
		await embedBlueskyPosts(standalone(URL_A), { fetch, cacheDir, now: () => NOW + DAY });
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('retries a post whose fetch failed', async () => {
		const fetch = vi
			.fn<(url: string) => Promise<Response>>()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(json({ thread: alice }));
		const options = { fetch: fetch as typeof globalThis.fetch, cacheDir, now: () => NOW };

		expect(await embedBlueskyPosts(standalone(URL_A), options)).toBe(standalone(URL_A));
		expect(await embedBlueskyPosts(standalone(URL_A), options)).toBe(renderPost(alice));
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('embeds from a cached real thread', async () => {
		fs.copyFileSync(
			path.join(FIXTURES, 'bnb.im-3mwvwapoefs26.json'),
			path.join(cacheDir, 'bnb.im-3mwvwapoefs26.json')
		);
		const { fetchedAt, thread: cachedThread } = fixture('bnb.im-3mwvwapoefs26');
		const url = 'https://bsky.app/profile/bnb.im/post/3mwvwapoefs26';
		const fetch = vi.fn();

		const html = await embedBlueskyPosts(standalone(url), {
			fetch,
			cacheDir,
			now: () => fetchedAt
		});
		expect(html).toBe(renderPost(cachedThread));
		expect(fetch).not.toHaveBeenCalled();
	});

	it('returns HTML without post links as it is', async () => {
		const input = '<p>Nothing to see.</p>';
		expect(await embedBlueskyPosts(input)).toBe(input);
	});
});
