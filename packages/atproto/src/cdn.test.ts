import { describe, expect, it } from 'vitest';
import { DID, blobUrl, fullUrl, thumbUrl } from './index';

describe('image urls', () => {
	it('builds CDN + raw-blob urls for the account', () => {
		expect(thumbUrl('X')).toBe(`https://cdn.bsky.app/img/feed_thumbnail/plain/${DID}/X@jpeg`);
		expect(fullUrl('X')).toBe(`https://cdn.bsky.app/img/feed_fullsize/plain/${DID}/X@jpeg`);
		expect(blobUrl('https://pds.example', 'X')).toBe(
			`https://pds.example/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=X`
		);
	});

	it('builds them for any DID', () => {
		expect(thumbUrl('X', 'did:plc:other')).toContain('/did:plc:other/X@jpeg');
		expect(fullUrl('X', 'did:plc:other')).toContain('/did:plc:other/X@jpeg');
		expect(blobUrl('https://pds.example', 'X', 'did:plc:other')).toContain('did=did:plc:other');
	});
});
