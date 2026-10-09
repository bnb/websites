import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRecord, resolveIdentity } from './slingshot';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function slingshot(respond: (url: URL) => Response) {
	const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		return respond(new URL(String(input)));
	});
	vi.stubGlobal('fetch', fetch);
	return () => fetch.mock.calls.map(([input]) => new URL(String(input)));
}

afterEach(() => {
	vi.unstubAllGlobals();
});

// as Slingshot answered for a real favorite, October 2026
const FAVORITE = {
	cid: 'bafyreicztarjgbkl456k3zagbmgxbhugpxpfoml5hlqzo7wtbmhmrvpudi',
	uri: 'at://did:plc:lcbtt32aexvcuwlt4alf6qsw/social.grain.favorite/3mvqesjdlfk2p',
	value: {
		$type: 'social.grain.favorite',
		createdAt: '2026-09-17T19:21:30.630Z',
		subject: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/social.grain.gallery/3mvnxcannmzke'
	}
};
const REF = {
	repo: 'did:plc:lcbtt32aexvcuwlt4alf6qsw',
	collection: 'social.grain.favorite',
	rkey: '3mvqesjdlfk2p'
};

describe('getRecord', () => {
	it('reads anyone’s record from Slingshot', async () => {
		const requested = slingshot(() => json(FAVORITE));
		await expect(getRecord(REF)).resolves.toEqual(FAVORITE);
		const [url] = requested();
		expect(url.origin + url.pathname).toBe(
			'https://slingshot.microcosm.blue/xrpc/com.atproto.repo.getRecord'
		);
		expect(Object.fromEntries(url.searchParams)).toEqual(REF);
	});

	it('says when there’s no such record', async () => {
		slingshot(() =>
			json(
				{
					error: 'RecordNotFound',
					message: 'Upstream bad request: Could not locate record: at://…'
				},
				400
			)
		);
		await expect(getRecord({ ...REF, rkey: 'nope' })).rejects.toMatchObject({
			name: 'AtmosphereError',
			kind: 'http',
			status: 400,
			message: 'Upstream bad request: Could not locate record: at://…'
		});
	});

	it('won’t pass on an answer that isn’t a record', async () => {
		for (const body of [null, { uri: FAVORITE.uri }, { cid: FAVORITE.cid, value: {} }]) {
			slingshot(() => json(body));
			await expect(getRecord(REF)).rejects.toMatchObject({ kind: 'invalid' });
		}
	});
});

describe('resolveIdentity', () => {
	const MINI_DOC = {
		did: 'did:plc:uashgn65n5z7aqwk5cbuba5c',
		handle: 'bnb.im',
		pds: 'https://shiitake.us-east.host.bsky.network',
		signing_key: 'zQ3shZdYjfuJw4SQSUKS1756WvkusERRQPJAFxdoMZnvQB7fX'
	};

	it('resolves a handle or DID to its DID, handle and PDS', async () => {
		const requested = slingshot(() => json(MINI_DOC));
		await expect(resolveIdentity('bnb.im')).resolves.toEqual({
			did: MINI_DOC.did,
			handle: 'bnb.im',
			pds: MINI_DOC.pds
		});
		const [url] = requested();
		expect(url.pathname).toBe('/xrpc/blue.microcosm.identity.resolveMiniDoc');
		expect(url.searchParams.get('identifier')).toBe('bnb.im');
	});

	it('says why it couldn’t', async () => {
		slingshot(() =>
			json(
				{ error: 'InvalidRequest', message: 'Errored while trying to resolve handle to DID' },
				400
			)
		);
		await expect(resolveIdentity('nobody.invalid')).rejects.toMatchObject({
			kind: 'http',
			message: 'Errored while trying to resolve handle to DID'
		});
		slingshot(() => json({ did: MINI_DOC.did, handle: 'bnb.im' }));
		await expect(resolveIdentity('bnb.im')).rejects.toMatchObject({ kind: 'invalid' });
	});
});
