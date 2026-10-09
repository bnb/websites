// An in-memory PDS behind a stubbed fetch, for syncing against: records keyed
// by collection/rkey, plus a log of every write. Like a strict PDS, it
// rejects records the lexicons don't allow, and every request has to come
// with a timeout. `routes` answers any other URL (images, the Bluesky
// appview), keyed by origin and path.
import { expect, vi } from 'vitest';
import { blobCid } from '../bytes';
import { json } from './fetch';
import { assertValidRecord } from './records';

export const DID = 'did:plc:synctest';
export const PDS = 'https://pds.example';
export const PUBLICATION_RKEY = '3lpub2222222';
export const PUBLICATION = `at://${DID}/site.standard.publication/${PUBLICATION_RKEY}`;
export const SITE = 'https://example.com';

/** A PNG header, which is all imageInfo needs, padded out to `size` bytes. */
export function png(width = 10, height = 5, size = 32) {
	const bytes = Buffer.alloc(size);
	bytes.writeUInt32BE(0x89504e47, 0);
	bytes.writeUInt32BE(width, 16);
	bytes.writeUInt32BE(height, 20);
	return bytes;
}

type Route = (url: URL, init: RequestInit) => Response | Promise<Response>;
type Value = Record<string, unknown>;

export interface FakePds {
	records: Record<string, Value>;
	writes: Array<['put' | 'delete', string, string]>;
	uploads: number;
	logins: string[];
	requests: string[];
}

export function fakePds({
	records = {},
	publication = { $type: 'site.standard.publication', url: SITE, name: 'Test' },
	sessionDid = DID,
	routes = {}
}: {
	records?: Record<string, Value>;
	publication?: Value | null;
	sessionDid?: string;
	routes?: Record<string, Route>;
} = {}): FakePds {
	const state: FakePds = {
		records: structuredClone(records),
		writes: [],
		uploads: 0,
		logins: [],
		requests: []
	};
	if (publication) {
		state.records[`site.standard.publication/${PUBLICATION_RKEY}`] = structuredClone(publication);
	}

	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
		const url = new URL(String(input));
		state.requests.push(url.href);
		expect(init.signal, `no signal on ${url}`).toBeInstanceOf(AbortSignal);
		const headers = (init.headers ?? {}) as Record<string, string>;
		const bytes = init.body instanceof Uint8Array ? Buffer.from(init.body) : null;
		const body = (init.body && !bytes ? JSON.parse(String(init.body)) : {}) as Value & {
			collection: string;
			rkey: string;
			record: Value;
		};

		const route = routes[`${url.origin}${url.pathname}`];
		if (route) return route(url, init);
		if (url.href === `https://plc.directory/${DID}`) {
			return json({ service: [{ id: '#atproto_pds', serviceEndpoint: PDS }] });
		}
		if (url.origin !== PDS) throw new Error(`unexpected fetch ${url}`);

		const authorized = () =>
			expect(headers.authorization, `no session on ${url}`).toBe('Bearer jwt');
		switch (url.pathname.replace('/xrpc/', '')) {
			case 'com.atproto.server.createSession':
				state.logins.push(body.identifier as string);
				return body.password === 'secret'
					? json({ did: sessionDid, accessJwt: 'jwt' })
					: json({ error: 'AuthenticationRequired', message: 'Invalid password' }, 401);
			case 'com.atproto.repo.listRecords': {
				const collection = url.searchParams.get('collection');
				return json({
					records: Object.entries(state.records)
						.filter(([key]) => key.startsWith(`${collection}/`))
						.map(([key, value]) => ({ uri: `at://${DID}/${key}`, cid: 'bafy', value }))
				});
			}
			case 'com.atproto.repo.getRecord': {
				const key = `${url.searchParams.get('collection')}/${url.searchParams.get('rkey')}`;
				const value = state.records[key];
				return value
					? json({ uri: `at://${DID}/${key}`, cid: 'bafy', value })
					: json({ error: 'RecordNotFound' }, 400);
			}
			case 'com.atproto.repo.putRecord':
				authorized();
				try {
					assertValidRecord(body.collection, body.record);
				} catch (error) {
					return json({ error: 'InvalidRecord', message: (error as Error).message }, 400);
				}
				state.records[`${body.collection}/${body.rkey}`] = structuredClone(body.record);
				state.writes.push(['put', body.collection, body.rkey]);
				return json({ uri: `at://${DID}/${body.collection}/${body.rkey}`, cid: 'bafy' });
			case 'com.atproto.repo.deleteRecord':
				authorized();
				delete state.records[`${body.collection}/${body.rkey}`];
				state.writes.push(['delete', body.collection, body.rkey]);
				return json({});
			case 'com.atproto.repo.uploadBlob':
				authorized();
				state.uploads++;
				return json({
					blob: {
						$type: 'blob',
						ref: { $link: blobCid(bytes!) },
						mimeType: headers['content-type'],
						size: bytes!.length
					}
				});
		}
		throw new Error(`unexpected fetch ${url}`);
	});
	return state;
}
