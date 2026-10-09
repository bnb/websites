import { setTimeout as sleep } from 'node:timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Pds, resolvePds, TIMEOUT, XrpcError } from './pds';
import { fetchSequence, json } from './test/fetch';

// rate limit waits are recorded instead of sat through
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => undefined) }));
const waits = () => vi.mocked(sleep).mock.calls.map(([ms]) => ms);

afterEach(() => {
	vi.restoreAllMocks();
	vi.mocked(sleep).mockClear();
	vi.useRealTimers();
});

const PDS = 'https://pds.example';
const didDocument = (...service: Array<{ id: string; serviceEndpoint: string }>) =>
	json({ service });

describe('resolvePds', () => {
	it('finds the PDS in a did:plc document', async () => {
		const calls = fetchSequence(
			didDocument(
				{ id: '#atproto_labeler', serviceEndpoint: 'https://labeler.example' },
				{ id: '#atproto_pds', serviceEndpoint: 'https://pds.example/' }
			)
		);
		await expect(resolvePds('did:plc:abc')).resolves.toBe(PDS);
		expect(calls[0].url.href).toBe('https://plc.directory/did:plc:abc');
		expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
	});

	it('finds the PDS in a did:web document, by its full id too', async () => {
		const did = 'did:web:example.com%3A8443';
		const calls = fetchSequence(didDocument({ id: `${did}#atproto_pds`, serviceEndpoint: PDS }));
		await expect(resolvePds(did)).resolves.toBe(PDS);
		expect(calls[0].url.href).toBe('https://example.com:8443/.well-known/did.json');
	});

	it("fails on DIDs it can't resolve", async () => {
		await expect(resolvePds('did:key:z6Mk')).rejects.toThrow(
			'Unsupported DID method: did:key:z6Mk'
		);

		fetchSequence(new Response('', { status: 404 }));
		await expect(resolvePds('did:plc:gone')).rejects.toThrow('Resolving did:plc:gone failed: 404');

		fetchSequence(json({}));
		await expect(resolvePds('did:plc:nopds')).rejects.toThrow(
			'did:plc:nopds has no PDS in its DID document'
		);

		fetchSequence(didDocument({ id: 'did:plc:someone-else#atproto_pds', serviceEndpoint: PDS }));
		await expect(resolvePds('did:plc:mine')).rejects.toThrow('has no PDS in its DID document');
	});

	it('gives Pds.forDid the DID’s PDS', async () => {
		fetchSequence(didDocument({ id: '#atproto_pds', serviceEndpoint: PDS }));
		expect((await Pds.forDid('did:plc:abc')).service).toBe(PDS);
	});
});

describe('Pds.request', () => {
	it('sends query params, skipping undefined ones', async () => {
		const calls = fetchSequence(json({ ok: true }));
		await expect(
			new Pds(PDS).request('GET', 'com.example.ping', {
				params: { a: 'x y', n: 2, skipped: undefined }
			})
		).resolves.toEqual({ ok: true });
		expect(calls[0].url.href).toBe(`${PDS}/xrpc/com.example.ping?a=x+y&n=2`);
		expect(calls[0].init).toMatchObject({ method: 'GET', headers: {} });
		expect(calls[0].init).not.toHaveProperty('body');
		expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
	});

	it('sends JSON, and the session token once logged in', async () => {
		const pds = new Pds(PDS);
		const calls = fetchSequence(json({ did: 'did:plc:abc', accessJwt: 'jwt' }), json({}));
		await expect(pds.login('me.example', 'pw')).resolves.toEqual({
			did: 'did:plc:abc',
			accessJwt: 'jwt'
		});
		expect(pds.accessJwt).toBe('jwt');
		await pds.deleteRecord('did:plc:abc', 'x.y.z', 'rkey');

		const [login, del] = calls;
		expect(login.url.href).toBe(`${PDS}/xrpc/com.atproto.server.createSession`);
		expect(login.init.method).toBe('POST');
		expect(login.init.headers).toEqual({ 'content-type': 'application/json' });
		expect(JSON.parse(String(login.init.body))).toEqual({
			identifier: 'me.example',
			password: 'pw'
		});

		expect(del.url.pathname).toBe('/xrpc/com.atproto.repo.deleteRecord');
		expect(del.init.headers).toEqual({
			authorization: 'Bearer jwt',
			'content-type': 'application/json'
		});
		expect(JSON.parse(String(del.init.body))).toEqual({
			repo: 'did:plc:abc',
			collection: 'x.y.z',
			rkey: 'rkey'
		});
	});

	it('sends a buffer as raw bytes', async () => {
		const calls = fetchSequence(json({}));
		await new Pds(PDS).request('POST', 'com.example.bytes', {
			body: Buffer.from([1, 2, 3]),
			headers: { 'content-type': 'image/png' }
		});
		expect(calls[0].init.body).toBeInstanceOf(Uint8Array);
		expect([...(calls[0].init.body as Uint8Array)]).toEqual([1, 2, 3]);
		expect(calls[0].init.headers).toEqual({ 'content-type': 'image/png' });
	});

	it('throws errors that carry the status and XRPC error code', async () => {
		const pds = new Pds(PDS);
		fetchSequence(
			json({ error: 'InvalidRequest', message: 'Bad record' }, 400),
			new Response('<html>Bad Gateway</html>', { status: 502 }),
			json({ message: 'Just a message' }, 500)
		);
		const error = await pds.putRecord('did:plc:abc', 'x.y.z', 'rkey', {}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(XrpcError);
		expect(error).toMatchObject({
			message: 'com.atproto.repo.putRecord failed: 400 InvalidRequest Bad record',
			status: 400,
			code: 'InvalidRequest'
		});
		await expect(pds.putRecord('did:plc:abc', 'x.y.z', 'rkey', {})).rejects.toMatchObject({
			message: 'com.atproto.repo.putRecord failed: 502',
			status: 502,
			code: undefined
		});
		await expect(pds.request('GET', 'com.example.ping')).rejects.toMatchObject({
			message: 'com.example.ping failed: 500  Just a message',
			status: 500
		});
	});

	it('gives every request 30 seconds before it’s given up on', async () => {
		const timeout = vi.spyOn(AbortSignal, 'timeout');
		fetchSequence(didDocument({ id: '#atproto_pds', serviceEndpoint: PDS }), json({}));
		await (await Pds.forDid('did:plc:abc')).request('GET', 'com.example.ping');
		expect(TIMEOUT).toBe(30_000);
		expect(timeout.mock.calls).toEqual([[TIMEOUT], [TIMEOUT]]);
	});
});

describe('rate limits', () => {
	const limited = (headers: Record<string, string> = {}) =>
		json({ error: 'RateLimitExceeded' }, 429, headers);

	it('waits as long as retry-after says, then tries again', async () => {
		const calls = fetchSequence(limited({ 'retry-after': '2' }), json({ ok: true }));
		await expect(new Pds(PDS).request('GET', 'com.example.ping')).resolves.toEqual({ ok: true });
		expect(calls).toHaveLength(2);
		expect(waits()).toEqual([2000]);
	});

	it('waits until ratelimit-reset when there’s no retry-after', async () => {
		vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-01-01T00:00:00Z') });
		const now = Date.now() / 1000;
		fetchSequence(
			limited({ 'ratelimit-reset': String(now + 5) }),
			// a reset that's already passed is no wait at all
			limited({ 'ratelimit-reset': String(now - 5) }),
			json({ ok: true })
		);
		await new Pds(PDS).request('GET', 'com.example.ping');
		expect(waits()).toEqual([5000, 0]);
	});

	it('waits a second when the response doesn’t say how long', async () => {
		fetchSequence(
			limited({ 'retry-after': 'Wed, 21 Oct 2015 07:28:00 GMT', 'ratelimit-reset': 'soon' }),
			limited(),
			json({ ok: true })
		);
		await new Pds(PDS).request('GET', 'com.example.ping');
		expect(waits()).toEqual([1000, 1000]);
	});

	it('gives up on a wait over a minute', async () => {
		const calls = fetchSequence(limited({ 'retry-after': '61' }));
		await expect(new Pds(PDS).request('GET', 'com.example.ping')).rejects.toMatchObject({
			message: 'com.example.ping failed: 429 RateLimitExceeded',
			status: 429,
			code: 'RateLimitExceeded'
		});
		expect(calls).toHaveLength(1);
		expect(waits()).toEqual([]);

		// a minute exactly is still worth the wait
		fetchSequence(limited({ 'retry-after': '60' }), json({}));
		await new Pds(PDS).request('GET', 'com.example.ping');
		expect(waits()).toEqual([60_000]);
	});

	it('gives up after three retries', async () => {
		const calls = fetchSequence(
			...Array.from({ length: 5 }, () => limited({ 'retry-after': '0' }))
		);
		await expect(new Pds(PDS).request('GET', 'com.example.ping')).rejects.toMatchObject({
			status: 429
		});
		expect(calls).toHaveLength(4);
		expect(waits()).toEqual([0, 0, 0]);
	});

	it('only retries 429s', async () => {
		const calls = fetchSequence(
			json({ error: 'InternalServerError' }, 503, { 'retry-after': '1' })
		);
		await expect(new Pds(PDS).request('GET', 'com.example.ping')).rejects.toMatchObject({
			status: 503
		});
		expect(calls).toHaveLength(1);
		expect(waits()).toEqual([]);
	});
});

describe('records', () => {
	it('getRecord gets one record, or null when it isn’t there', async () => {
		const pds = new Pds(PDS);
		const record = { uri: 'at://did:plc:abc/x.y.z/rkey', cid: 'bafy', value: { a: 1 } };
		const calls = fetchSequence(
			json(record),
			json({ error: 'RecordNotFound', message: 'Could not locate record' }, 400),
			json({ error: 'InternalServerError' }, 500)
		);
		await expect(pds.getRecord('did:plc:abc', 'x.y.z', 'rkey')).resolves.toEqual(record);
		expect(calls[0].init.method).toBe('GET');
		expect(calls[0].url.pathname).toBe('/xrpc/com.atproto.repo.getRecord');
		expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({
			repo: 'did:plc:abc',
			collection: 'x.y.z',
			rkey: 'rkey'
		});
		await expect(pds.getRecord('did:plc:abc', 'x.y.z', 'rkey')).resolves.toBeNull();
		await expect(pds.getRecord('did:plc:abc', 'x.y.z', 'rkey')).rejects.toThrow(
			'com.atproto.repo.getRecord failed: 500 InternalServerError'
		);
	});

	it('getRecord rethrows what isn’t an XRPC error', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
		await expect(new Pds(PDS).getRecord('did:plc:abc', 'x.y.z', 'rkey')).rejects.toThrow(
			'fetch failed'
		);
	});

	it('listRecords follows the cursor to the last page', async () => {
		const calls = fetchSequence(
			json({ records: [{ uri: 'a' }, { uri: 'b' }], cursor: 'c1' }),
			json({ records: [{ uri: 'c' }], cursor: 'c2' }),
			// some PDSes hand back a cursor with an empty last page
			json({ records: [], cursor: 'c3' })
		);
		const records = await new Pds(PDS).listRecords('did:plc:abc', 'x.y.z');
		expect(records.map((record) => record.uri)).toEqual(['a', 'b', 'c']);
		expect(calls.map((call) => call.url.searchParams.get('cursor'))).toEqual([null, 'c1', 'c2']);
		expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({
			repo: 'did:plc:abc',
			collection: 'x.y.z',
			limit: '100'
		});

		fetchSequence(json({ records: [{ uri: 'only' }] }));
		expect(await new Pds(PDS).listRecords('did:plc:abc', 'x.y.z')).toEqual([{ uri: 'only' }]);
	});

	it('putRecord writes the record under its key', async () => {
		const calls = fetchSequence(json({ uri: 'at://did:plc:abc/x.y.z/rkey', cid: 'bafy' }));
		await expect(
			new Pds(PDS).putRecord('did:plc:abc', 'x.y.z', 'rkey', { $type: 'x.y.z', a: 1 })
		).resolves.toEqual({ uri: 'at://did:plc:abc/x.y.z/rkey', cid: 'bafy' });
		expect(calls[0].init.method).toBe('POST');
		expect(calls[0].url.pathname).toBe('/xrpc/com.atproto.repo.putRecord');
		expect(JSON.parse(String(calls[0].init.body))).toEqual({
			repo: 'did:plc:abc',
			collection: 'x.y.z',
			rkey: 'rkey',
			record: { $type: 'x.y.z', a: 1 }
		});
	});

	it('uploadBlob sends the bytes with their type and hands back the blob ref', async () => {
		const pds = new Pds(PDS);
		pds.accessJwt = 'jwt';
		const blob = { $type: 'blob', ref: { $link: 'bafk' }, mimeType: 'image/png', size: 3 };
		const calls = fetchSequence(json({ blob }));
		await expect(pds.uploadBlob(Buffer.from([1, 2, 3]), 'image/png')).resolves.toEqual(blob);
		expect(calls[0].url.pathname).toBe('/xrpc/com.atproto.repo.uploadBlob');
		expect([...(calls[0].init.body as Uint8Array)]).toEqual([1, 2, 3]);
		expect(calls[0].init.headers).toEqual({
			'content-type': 'image/png',
			authorization: 'Bearer jwt'
		});
	});
});
