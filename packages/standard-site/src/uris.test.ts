import { describe, expect, it } from 'vitest';
import { deterministicTid } from './tid';
import { documentUris, type Dated } from './uris';

const DID = 'did:plc:author';
const DATE = new Date('2026-01-01T00:00:00Z');
const document = (rkey: string) => `at://${DID}/site.standard.document/${rkey}`;
const post = (key: string, fields: Partial<Dated> = {}): Dated => ({
	key,
	order: `posts/${key}.md`,
	date: DATE,
	...fields
});

// two slugs whose hashes give the same clock id, so on the same date they'd
// derive the same TID
const TWINS = ['post-17', 'post-27'];

describe('documentUris', () => {
	it('keeps a pinned URI, and derives one from the date and key otherwise', () => {
		const pinned = document('3lpinned2222');
		const uris = documentUris([post('a', { atUri: pinned }), post('b')], DID);
		expect(uris).toEqual(
			new Map([
				['a', { uri: pinned, pinned: true }],
				['b', { uri: document(deterministicTid(DATE, 'b')), pinned: false }]
			])
		);
	});

	it('steps around a URI a pinned post already holds', () => {
		const taken = deterministicTid(DATE, 'b');
		const uris = documentUris([post('b'), post('a', { atUri: document(taken) })], DID);
		expect(uris.get('a')).toEqual({ uri: document(taken), pinned: true });
		expect(uris.get('b')).toEqual({ uri: document(deterministicTid(DATE, 'b', 1)), pinned: false });
	});

	it('steps around collisions between derived URIs, in order', () => {
		expect(deterministicTid(DATE, TWINS[0])).toBe(deterministicTid(DATE, TWINS[1]));
		// handed in backwards, but posts/post-17.md sorts first and keeps its URI
		const uris = documentUris([post(TWINS[1]), post(TWINS[0])], DID);
		expect(uris.get(TWINS[0])?.uri).toBe(document(deterministicTid(DATE, TWINS[0])));
		expect(uris.get(TWINS[1])?.uri).toBe(document(deterministicTid(DATE, TWINS[1], 1)));

		// with the order the other way around, so are the URIs
		const swapped = documentUris(
			[post(TWINS[0], { order: 'b' }), post(TWINS[1], { order: 'a' })],
			DID
		);
		expect(swapped.get(TWINS[1])?.uri).toBe(document(deterministicTid(DATE, TWINS[1])));
		expect(swapped.get(TWINS[0])?.uri).toBe(document(deterministicTid(DATE, TWINS[0], 1)));
	});

	it('keeps posts that sort the same in the order they came', () => {
		const uris = documentUris(
			[post(TWINS[1], { order: 'same' }), post(TWINS[0], { order: 'same' })],
			DID
		);
		expect(uris.get(TWINS[1])?.uri).toBe(document(deterministicTid(DATE, TWINS[1])));
		expect(uris.get(TWINS[0])?.uri).toBe(document(deterministicTid(DATE, TWINS[0], 1)));
	});

	it('keeps stepping until it finds a free URI', () => {
		const taken = [0, 1].map((bump) => deterministicTid(DATE, TWINS[0], bump));
		const uris = documentUris(
			[
				post(TWINS[0]),
				post('pinned-a', { atUri: document(taken[1]) }),
				post(TWINS[1], { order: 'z' })
			],
			DID
		);
		expect(uris.get(TWINS[0])?.uri).toBe(document(taken[0]));
		expect(uris.get(TWINS[1])?.uri).toBe(document(deterministicTid(DATE, TWINS[1], 2)));
	});

	it('refuses a pinned URI in another repo or collection', () => {
		expect(() =>
			documentUris([post('a', { atUri: 'at://did:plc:other/site.standard.document/3l2' })], DID)
		).toThrow(
			"posts/a.md has atUri at://did:plc:other/site.standard.document/3l2, which isn't a site.standard.document in did:plc:author"
		);
		expect(() =>
			documentUris([post('a', { atUri: `at://${DID}/app.bsky.feed.post/3l2` })], DID)
		).toThrow("isn't a site.standard.document in did:plc:author");
		expect(() => documentUris([post('a', { atUri: 'https://example.com/' })], DID)).toThrow(
			'Not an at:// record URI'
		);
	});

	it('hands back nothing for no posts', () => {
		expect(documentUris([], DID).size).toBe(0);
	});
});
