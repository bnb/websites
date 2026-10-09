import { describe, expect, it } from 'vitest';
import { ACCOUNT_URI, DID, atTags, recordUri } from './index';

describe('AT Tags', () => {
	it('writes one tag per AT URI, in the order me, canonical, alternate, author', () => {
		const photo = recordUri('social.grain.photo', '3la');
		expect(
			atTags({
				author: [ACCOUNT_URI],
				alternate: [photo, recordUri('x.y.z', 'b')],
				me: [ACCOUNT_URI]
			})
		).toEqual([
			{ name: 'at:me', content: `at://${DID}` },
			{ name: 'at:alternate', content: `at://${DID}/social.grain.photo/3la` },
			{ name: 'at:alternate', content: `at://${DID}/x.y.z/b` },
			{ name: 'at:author', content: `at://${DID}` }
		]);
	});

	it('writes nothing for nothing, and records in any repo', () => {
		expect(atTags({})).toEqual([]);
		expect(atTags({ canonical: [recordUri('a.b.c', 'k', 'did:plc:other')] })).toEqual([
			{ name: 'at:canonical', content: 'at://did:plc:other/a.b.c/k' }
		]);
	});
});
