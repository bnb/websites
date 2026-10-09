import { afterEach, describe, expect, it, vi } from 'vitest';
import { countLinks, listLinks } from './constellation';
import { AtmosphereError } from './errors';

const GALLERY = 'at://did:plc:author/social.grain.gallery/3mvnxcannmzke';
const LIKES = { target: GALLERY, collection: 'social.grain.favorite', path: '.subject' };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Constellation behind a stubbed fetch, answering every request with `respond`. */
function constellation(respond: (url: URL) => Response | Promise<Response>) {
	const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		return respond(new URL(String(input)));
	});
	vi.stubGlobal('fetch', fetch);
	return fetch;
}
const requested = (fetch: ReturnType<typeof constellation>) =>
	fetch.mock.calls.map(([input]) => new URL(String(input)));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('countLinks', () => {
	it('asks Constellation how many records link to the target', async () => {
		const fetch = constellation(() => json({ total: 8 }));
		await expect(countLinks(LIKES)).resolves.toBe(8);
		const [url] = requested(fetch);
		expect(url.origin).toBe('https://constellation.microcosm.blue');
		expect(url.pathname).toBe('/links/count');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			target: GALLERY,
			collection: 'social.grain.favorite',
			path: '.subject'
		});
	});

	it('gives up after the timeout it’s handed', async () => {
		const timeout = vi.spyOn(AbortSignal, 'timeout');
		constellation(() => json({ total: 0 }));
		await countLinks(LIKES, { timeout: 2_000 });
		expect(timeout).toHaveBeenCalledWith(2_000);
		await countLinks(LIKES);
		expect(timeout).toHaveBeenLastCalledWith(10_000);
	});

	it('uses the fetch it’s handed', async () => {
		const own = vi.fn(async () => json({ total: 3 }));
		await expect(countLinks(LIKES, { fetch: own })).resolves.toBe(3);
		expect(own).toHaveBeenCalledOnce();
	});

	it('throws an AtmosphereError, never anything else', async () => {
		const failure = async (respond: () => Response | Promise<Response>) => {
			constellation(respond);
			const error = await countLinks(LIKES).catch((caught: unknown) => caught);
			expect(error).toBeInstanceOf(AtmosphereError);
			return error as AtmosphereError;
		};

		await expect(
			failure(() => json({ error: 'BadTarget', message: 'no' }, 400))
		).resolves.toMatchObject({
			kind: 'http',
			status: 400,
			message: 'no'
		});
		await expect(failure(() => new Response('upstream', { status: 502 }))).resolves.toMatchObject({
			kind: 'http',
			status: 502,
			message: 'constellation.microcosm.blue answered 502'
		});
		await expect(failure(() => json({ error: 503 }, 503))).resolves.toMatchObject({
			message: 'constellation.microcosm.blue answered 503'
		});
		await expect(failure(() => json({ links: {} }))).resolves.toMatchObject({ kind: 'invalid' });
		await expect(failure(() => new Response('<html>'))).resolves.toMatchObject({ kind: 'invalid' });
		await expect(
			failure(() => Promise.reject(new TypeError('fetch failed')))
		).resolves.toMatchObject({ kind: 'network', message: 'fetch failed' });
		await expect(failure(() => Promise.reject(new TypeError('')))).resolves.toMatchObject({
			kind: 'network',
			message: "constellation.microcosm.blue didn't answer"
		});
		await expect(
			failure(() => Promise.reject(new DOMException('signal timed out', 'TimeoutError')))
		).resolves.toMatchObject({
			kind: 'timeout',
			message: 'constellation.microcosm.blue took too long'
		});
	});

	it('counts a body cut off by the timeout as too slow', async () => {
		constellation(
			() =>
				({
					ok: true,
					status: 200,
					json: () => Promise.reject(new DOMException('signal timed out', 'TimeoutError'))
				}) as Response
		);
		await expect(countLinks(LIKES)).rejects.toMatchObject({ kind: 'timeout' });
	});
});

describe('listLinks', () => {
	const records = [
		{ did: 'did:plc:one', collection: 'social.grain.favorite', rkey: '3mvqesjdlfk2p' },
		{ did: 'did:plc:two', collection: 'social.grain.favorite', rkey: '3mvpjfpe6hw2p' }
	];

	it('lists a page of the records linking to the target', async () => {
		const fetch = constellation(() =>
			json({ total: 8, linking_records: records, cursor: '080005' })
		);
		await expect(listLinks(LIKES)).resolves.toEqual({ total: 8, records, cursor: '080005' });
		const [url] = requested(fetch);
		expect(url.pathname).toBe('/links');
		expect([...url.searchParams.keys()]).toEqual(['target', 'collection', 'path']);
	});

	it('narrows to one account, and pages', async () => {
		const fetch = constellation(() =>
			json({ total: 1, linking_records: records.slice(0, 1), cursor: null })
		);
		await expect(
			listLinks({ ...LIKES, did: 'did:plc:one', limit: 3, cursor: '080005' })
		).resolves.toEqual({ total: 1, records: records.slice(0, 1), cursor: null });
		const [url] = requested(fetch);
		expect(url.searchParams.get('did')).toBe('did:plc:one');
		expect(url.searchParams.get('limit')).toBe('3');
		expect(url.searchParams.get('cursor')).toBe('080005');
	});

	it('won’t pass on records it doesn’t understand', async () => {
		for (const body of [
			[],
			{ linking_records: records },
			{ total: 2, linking_records: 'none' },
			{ total: 2, linking_records: [{ did: 'did:plc:one', rkey: 3 }] }
		]) {
			constellation(() => json(body));
			await expect(listLinks(LIKES)).rejects.toMatchObject({ kind: 'invalid' });
		}
	});
});
