import { describe, expect, it } from 'vitest';
import { isDid, parseAtUri } from './aturi';

describe('parseAtUri', () => {
	it('splits a record URI', () => {
		expect(parseAtUri('at://did:plc:abc/site.standard.document/3l2')).toEqual({
			did: 'did:plc:abc',
			collection: 'site.standard.document',
			rkey: '3l2'
		});
		expect(parseAtUri('at://did:web:example.com%3A8443/a.b.c/self')).toEqual({
			did: 'did:web:example.com%3A8443',
			collection: 'a.b.c',
			rkey: 'self'
		});
	});

	it.each([
		'https://example.com',
		'at://did:plc:abc/site.standard.document',
		'at://did:plc:abc/site.standard.document/3l2/extra',
		// a handle can change hands, so only DIDs
		'at://alice.example/site.standard.document/3l2',
		'at://did:plc:abc/not-an-nsid/3l2',
		'at://did:plc:abc/site.standard.document/..',
		'at://did:plc:abc/site.standard.document/.',
		'at://did:plc:abc/site.standard.document/has space',
		`at://did:plc:abc/site.standard.document/${'a'.repeat(513)}`,
		''
	])('rejects %j', (uri) => {
		expect(() => parseAtUri(uri)).toThrow(`Not an at:// record URI: ${uri}`);
	});

	it('rejects nothing at all', () => {
		expect(() => parseAtUri(undefined)).toThrow('Not an at:// record URI: undefined');
	});
});

describe('isDid', () => {
	it('takes DIDs of any method', () => {
		expect(isDid('did:plc:ewvi7nxzyoun6zhxrhs64oiz')).toBe(true);
		expect(isDid('did:web:example.com%3A8443')).toBe(true);
	});

	it('rejects anything else', () => {
		expect(isDid('did:plc:')).toBe(false);
		expect(isDid('did:PLC:abc')).toBe(false);
		expect(isDid('did:plc:abc:')).toBe(false);
		expect(isDid(`did:plc:${'a'.repeat(2048)}`)).toBe(false);
		expect(isDid('alice.example')).toBe(false);
		expect(isDid(42)).toBe(false);
		expect(isDid(undefined)).toBe(false);
	});
});
