import { describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_PDS,
	DID,
	MAX_PAGES,
	getRecord,
	latestRecord,
	listRecords,
	resolvePds
} from './index';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
	return { ok, status, json: async () => body } as unknown as Response;
}

const asFetch = (fn: unknown) => fn as typeof fetch;

describe('resolvePds', () => {
	it('reads the PDS endpoint from the DID document', async () => {
		const fetchFn = vi.fn(async () =>
			jsonResponse({
				service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' }]
			})
		);
		await expect(resolvePds(asFetch(fetchFn))).resolves.toBe('https://pds.example');
		expect(String(fetchFn.mock.calls[0])).toContain(`plc.directory/${DID}`);
	});

	it('falls back to the default PDS on error, missing service, or a throw', async () => {
		const notOk = vi.fn(async () => jsonResponse({}, false, 500));
		await expect(resolvePds(asFetch(notOk))).resolves.toBe(DEFAULT_PDS);

		const noService = vi.fn(async () => jsonResponse({ service: [] }));
		await expect(resolvePds(asFetch(noService))).resolves.toBe(DEFAULT_PDS);

		const throws = vi.fn(async () => {
			throw new Error('network down');
		});
		await expect(resolvePds(asFetch(throws))).resolves.toBe(DEFAULT_PDS);
	});

	it('resolves any DID, with its own fallback', async () => {
		const fetchFn = vi.fn(async () => jsonResponse({}, false, 404));
		await expect(
			resolvePds(asFetch(fetchFn), { did: 'did:plc:other', fallback: 'https://fallback.example' })
		).resolves.toBe('https://fallback.example');
		expect(String(fetchFn.mock.calls[0])).toContain('did:plc:other');
	});
});

describe('listRecords', () => {
	it('follows the cursor across pages and carries repo + cursor params', async () => {
		const page1 = {
			records: Array.from({ length: 100 }, (_, i) => ({ uri: `u${i}`, cid: `c${i}`, value: {} })),
			cursor: 'next'
		};
		const page2 = { records: [{ uri: 'u100', cid: 'c100', value: {} }] };
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(page1))
			.mockResolvedValueOnce(jsonResponse(page2));

		const out = await listRecords(asFetch(fetchFn), DEFAULT_PDS, 'social.grain.photo');
		expect(out).toHaveLength(101);
		expect(fetchFn).toHaveBeenCalledTimes(2);

		const secondUrl = String(fetchFn.mock.calls[1][0]);
		expect(secondUrl).toContain('cursor=next');
		expect(secondUrl).toContain(encodeURIComponent(DID));
	});

	it('treats a page without records as the end', async () => {
		const fetchFn = vi.fn(async () => jsonResponse({ cursor: 'more' }));
		await expect(listRecords(asFetch(fetchFn), DEFAULT_PDS, 'fm.plyr.track')).resolves.toEqual([]);
		expect(fetchFn).toHaveBeenCalledOnce();
	});

	it('stops at MAX_PAGES and warns that records were skipped', async () => {
		const full = {
			records: Array.from({ length: 100 }, (_, i) => ({ uri: `u${i}`, cid: `c${i}`, value: {} })),
			cursor: 'more'
		};
		const fetchFn = vi.fn(async () => jsonResponse(full));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const out = await listRecords(asFetch(fetchFn), DEFAULT_PDS, 'social.grain.photo');
		expect(fetchFn).toHaveBeenCalledTimes(MAX_PAGES);
		expect(out).toHaveLength(MAX_PAGES * 100);
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	it('throws on a non-ok response', async () => {
		const fetchFn = vi.fn(async () => jsonResponse({}, false, 400));
		await expect(
			listRecords(asFetch(fetchFn), DEFAULT_PDS, 'social.grain.photo')
		).rejects.toThrow();
	});

	it('reads another account’s repository', async () => {
		const fetchFn = vi.fn(async () => jsonResponse({ records: [] }));
		await listRecords(asFetch(fetchFn), DEFAULT_PDS, 'fm.plyr.track', { did: 'did:plc:other' });
		expect(String(fetchFn.mock.calls[0])).toContain('repo=did%3Aplc%3Aother');
	});
});

describe('latestRecord', () => {
	it('asks for one record, newest first, and returns it', async () => {
		const record = { uri: 'u', cid: 'c', value: { title: 'newest' } };
		const fetchFn = vi.fn(async () => jsonResponse({ records: [record], cursor: 'u' }));
		await expect(latestRecord(asFetch(fetchFn), DEFAULT_PDS, 'fm.plyr.track')).resolves.toEqual(
			record
		);
		expect(fetchFn).toHaveBeenCalledOnce();
		const url = new URL(String(fetchFn.mock.calls[0]));
		expect(url.searchParams.get('limit')).toBe('1');
		expect(url.searchParams.get('collection')).toBe('fm.plyr.track');
		expect(url.searchParams.get('repo')).toBe(DID);
		// the default order is newest first; reverse would give the oldest
		expect(url.searchParams.has('reverse')).toBe(false);
	});

	it('is null for an empty collection, and throws on a non-ok response', async () => {
		const empty = vi.fn(async () => jsonResponse({ records: [] }));
		await expect(latestRecord(asFetch(empty), DEFAULT_PDS, 'c')).resolves.toBeNull();

		const notOk = vi.fn(async () => jsonResponse({}, false, 502));
		await expect(latestRecord(asFetch(notOk), DEFAULT_PDS, 'c')).rejects.toThrow('502');
	});

	it('reads another account’s repository', async () => {
		const fetchFn = vi.fn(async () => jsonResponse({}));
		await latestRecord(asFetch(fetchFn), DEFAULT_PDS, 'c', { did: 'did:plc:other' });
		expect(String(fetchFn.mock.calls[0])).toContain('repo=did%3Aplc%3Aother');
	});
});

describe('getRecord', () => {
	it('returns the record value', async () => {
		const fetchFn = vi.fn(async () => jsonResponse({ value: { bio: 'girl rave dj' } }));
		await expect(
			getRecord(asFetch(fetchFn), DEFAULT_PDS, 'fm.plyr.actor.profile', 'self')
		).resolves.toEqual({ bio: 'girl rave dj' });
		const url = String(fetchFn.mock.calls[0]);
		expect(url).toContain('collection=fm.plyr.actor.profile');
		expect(url).toContain('rkey=self');
	});

	it('is null for a missing record, an error, or a throw', async () => {
		const missing = vi.fn(async () => jsonResponse({}));
		await expect(getRecord(asFetch(missing), DEFAULT_PDS, 'c', 'self')).resolves.toBeNull();

		const notOk = vi.fn(async () => jsonResponse({}, false, 400));
		await expect(getRecord(asFetch(notOk), DEFAULT_PDS, 'c', 'self')).resolves.toBeNull();

		const throws = vi.fn(async () => {
			throw new Error('network down');
		});
		await expect(getRecord(asFetch(throws), DEFAULT_PDS, 'c', 'self')).resolves.toBeNull();
	});
});
