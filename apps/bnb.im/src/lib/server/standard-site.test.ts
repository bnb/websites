import { describe, expect, it } from 'vitest';
import type { Post } from './posts';
import { findPost, loadPosts } from './posts';
import {
	DID,
	DOCUMENT,
	PUBLICATION,
	SCRIPT_PATH,
	callbackPage,
	clientMetadata,
	deterministicTid,
	documentUris,
	headTags
} from './standard-site';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const PUBLICATION_URI = /^at:\/\/did:plc:[a-z2-7]{24}\/site\.standard\.publication\/[2-7a-z]{13}$/;
const EPOCH_TID = /^2222222222/;

const TID = /^[2-7a-z]{13}$/;
const rkey = (uri: string) => uri.split('/').pop();
const documentUri = (key: string) => `at://${DID}/${DOCUMENT}/${key}`;

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

// What the original JavaScript deterministicTid() gives
// for each post's date and slug (run against the plugin's src/atproto.js).
// The posts' pinned atUris aren't these: they were minted from the clock when
// the records were first created, which is why they're pinned.
const PLUGIN_TIDS: Record<string, string> = {
	'an-unintentionally-comprehensive-introduction-to-github-actions-ci': '3gnwcnaqc225l',
	'atproto-essential-resources': '3mtuj6etk224t',
	'conditional-exports-supporting-both-import-and-require': '3i6xflqec22l7',
	'explicit-esm-in-node-js-with-mjs': '3i6uv4svk224a',
	'implicit-esm-in-node-js-with-type-module': '3i6uv4svk22ur',
	'is-mdm': '3m4enr3zc22e2',
	'jest-and-the-changedsince-flag-in-github-actions-ci': '3h4u3a6cs226b',
	'markdown-link-checking-in-github-with-actions': '3i3lbk5k222hw',
	'my-first-experience-attending-tc39': '3gakteqes22ys',
	'securely-automating-npm-publish-with-the-new-npm-automation-tokens': '3hkonc7gs22tf',
	'the-awesome-features-that-just-landed-with-node-js-v12': '3gbdxzwyc22ll',
	'the-new-npm-diff-command': '3hyyc5rdc22ge',
	'using-npx-and-npm-scripts-to-reduce-the-burden-of-developer-tools': '3gb4gn6m222wa',
	'what-is-the-atmosphere': '3mwu2vee2225z'
};

describe('deterministicTid', () => {
	it("derives the same key as the plugin for every post's date and slug", () => {
		for (const [slug, tid] of Object.entries(PLUGIN_TIDS)) {
			const found = findPost(slug);
			expect(found, slug).toBeDefined();
			expect(deterministicTid(found!.date, slug), slug).toBe(tid);
		}
	});

	it('matches the plugin with a bump, and for the publication key it derives', () => {
		const date = new Date('2026-10-02');
		expect(deterministicTid(date, 'what-is-the-atmosphere', 1)).toBe('3mwu2vee22262');
		expect(deterministicTid(new Date(Date.UTC(2024, 0, 1)), 'https://bnb.im')).toBe(
			'3khuwc44c225h'
		);
	});

	it('gives keys in the same shape as the clock-minted keys the posts pinned', () => {
		for (const p of loadPosts()) {
			expect(rkey(p.atUri!), p.file).toMatch(TID);
			expect(deterministicTid(p.date, p.slug), p.file).toMatch(TID);
		}
	});

	it('is a 13 character base32-sortable TID', () => {
		expect(deterministicTid(new Date('2021-06-16'), 'explicit-esm-in-node-js-with-mjs')).toMatch(
			TID
		);
		expect(deterministicTid(new Date(0), 'a')).toMatch(EPOCH_TID);
	});

	it('is the same for the same date and slug', () => {
		const date = new Date('2026-10-02');
		expect(deterministicTid(date, 'what-is-the-atmosphere')).toBe(
			deterministicTid(new Date('2026-10-02'), 'what-is-the-atmosphere')
		);
	});

	it('sorts by date, whatever the slug', () => {
		const older = deterministicTid(new Date('2019-04-15'), 'zzz');
		const newer = deterministicTid(new Date('2019-04-16'), 'aaa');
		expect(older < newer).toBe(true);
	});

	it('varies the clock id with the slug and the bump, keeping the timestamp', () => {
		const date = new Date('2021-06-16');
		const a = deterministicTid(date, 'a');
		const b = deterministicTid(date, 'b');
		const bumped = deterministicTid(date, 'a', 1);
		expect(new Set([a, b, bumped]).size).toBe(3);
		// the last two characters hold the 10 bit clock id
		expect(a.slice(0, 11)).toBe(b.slice(0, 11));
		expect(a.slice(0, 11)).toBe(bumped.slice(0, 11));
	});

	it('wraps the clock id around at 1024', () => {
		const date = new Date('2021-06-16');
		expect(deterministicTid(date, 'a', 1024)).toBe(deterministicTid(date, 'a'));
	});
});

describe('documentUris', () => {
	it('keeps pinned URIs and derives the rest', () => {
		const pinnedUri = documentUri('3mtxb3lixqw2v');
		const date = new Date('2026-10-02');
		const uris = documentUris([post('pinned', { atUri: pinnedUri }), post('fresh', { date })]);

		expect(uris.get('pinned')).toEqual({ uri: pinnedUri, pinned: true });
		expect(uris.get('fresh')).toEqual({
			uri: documentUri(deterministicTid(date, 'fresh')),
			pinned: false
		});
	});

	it('leaves drafts out', () => {
		const uris = documentUris([post('draft', { draft: true }), post('published')]);
		expect([...uris.keys()]).toEqual(['published']);
	});

	it('bumps the clock id when a derived key is already pinned', () => {
		const date = new Date('2026-10-02');
		const taken = deterministicTid(date, 'fresh');
		const uris = documentUris([
			post('fresh', { date }),
			post('older', { atUri: documentUri(taken) })
		]);

		expect(uris.get('older')?.uri).toBe(documentUri(taken));
		expect(uris.get('fresh')).toEqual({
			uri: documentUri(deterministicTid(date, 'fresh', 1)),
			pinned: false
		});
	});

	it('bumps until it finds a free key, in file order', () => {
		const date = new Date('2026-10-02');
		const uris = documentUris([
			post('b', { date, atUri: documentUri(deterministicTid(date, 'a', 1)) }),
			post('a', { date, atUri: undefined }),
			post('c', { date, atUri: documentUri(deterministicTid(date, 'a')) })
		]);
		expect(uris.get('a')?.uri).toBe(documentUri(deterministicTid(date, 'a', 2)));
	});

	it('never derives the same key twice', () => {
		const date = new Date('2026-10-02');
		// two posts that would derive the same key: same slug in different files
		const uris = documentUris([
			post('same', { date, file: '/posts/same.md' }),
			{ ...post('same', { date }), slug: 'same-again', file: '/posts/same-again.md' }
		]);
		expect(new Set(Array.from(uris.values(), ({ uri }) => uri)).size).toBe(2);
	});

	it("throws for an atUri that isn't a document in this repository", () => {
		expect(() =>
			documentUris([post('foreign', { atUri: 'at://did:plc:someone/site.standard.document/3abc' })])
		).toThrow(
			`/posts/foreign.md has atUri at://did:plc:someone/site.standard.document/3abc, which isn't a ${DOCUMENT} in ${DID}`
		);
		expect(() =>
			documentUris([post('wrong', { atUri: `at://${DID}/app.bsky.feed.post/3abc` })])
		).toThrow("isn't a site.standard.document");
	});

	it('gives every real post its pinned URI', () => {
		const posts = loadPosts();
		const uris = documentUris(posts);
		expect(uris.size).toBe(posts.filter(({ draft }) => !draft).length);
		for (const { slug, atUri } of posts.filter((p) => p.atUri)) {
			expect(uris.get(slug)).toEqual({ uri: atUri, pinned: true });
		}
	});
});

describe('headTags', () => {
	it('has only at:me without a document', () => {
		expect(headTags()).toEqual([{ name: 'at:me', content: `at://${DID}` }]);
	});

	it("ties a post's page to its record and the publication", () => {
		const uri = documentUri('3mwwg6sy4e32e');
		expect(headTags(uri)).toEqual([
			{ name: 'at:me', content: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c' },
			{ name: 'at:canonical', content: uri },
			{
				name: 'at:alternate',
				content: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.publication/3mtxb2uyta22l'
			},
			{ name: 'at:author', content: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c' },
			{ rel: 'site.standard.document', href: uri },
			{ rel: 'site.standard.publication', href: PUBLICATION.uri }
		]);
	});
});

describe('clientMetadata', () => {
	it('describes the site’s public browser OAuth client: subscriptions, upvotes and comments only', () => {
		expect(clientMetadata()).toEqual({
			client_id: 'https://bnb.im/oauth-client-metadata.json',
			client_name: 'Tierney Cyren',
			client_uri: 'https://bnb.im/',
			redirect_uris: ['https://bnb.im/oauth/callback/'],
			scope:
				'atproto repo:site.standard.graph.subscription?action=create&action=delete repo:at.upvote.signal?action=create&action=delete repo:at.upvote.comment?action=create&action=delete',
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'none',
			application_type: 'web',
			dpop_bound_access_tokens: true
		});
	});
});

describe('callbackPage', () => {
	const html = callbackPage();

	it('is a standalone page the subscribe script finishes signing in on', () => {
		expect(html.startsWith('<!DOCTYPE html>\n<html lang="en" data-standard-site-callback')).toBe(
			true
		);
		expect(html).toContain('data-handle-resolver="https://api.bsky.app"');
		expect(html).toContain('<meta name="robots" content="noindex">');
		expect(html).toContain(
			'<p data-standard-site-status>Finishing your subscription to Tierney Cyren…</p>'
		);
	});

	it('loads the subscribe script relative to /oauth/callback/', () => {
		expect(SCRIPT_PATH).toBe('/standard-site/subscribe.js');
		expect(html).toContain(
			'<script type="module" src="../../standard-site/subscribe.js"></script>'
		);
		expect(new URL('../../standard-site/subscribe.js', 'https://bnb.im/oauth/callback/').href).toBe(
			'https://bnb.im/standard-site/subscribe.js'
		);
	});
});

describe('PUBLICATION', () => {
	it('is the publication record in the blog author’s repository', () => {
		expect(PUBLICATION.uri).toBe(`at://${DID}/site.standard.publication/3mtxb2uyta22l`);
		expect(PUBLICATION.uri).toMatch(PUBLICATION_URI);
	});
});
