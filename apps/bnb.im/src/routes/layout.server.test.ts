import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+layout.server';
import * as layout from './+layout';

type LoadEvent = Parameters<typeof load>[0];

/** The PLC directory, and a PDS holding one newest record per collection. */
const pds = vi.fn(async (input: RequestInfo | URL) => {
	const url = new URL(String(input));
	if (url.hostname === 'plc.directory') {
		return Response.json({
			service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' }]
		});
	}
	const value = {
		'site.standard.document': { title: 'Is MDM', publishedAt: '2026-10-02T00:00:00.000Z' },
		'social.grain.photo': {
			photo: { $type: 'blob', ref: { $link: 'bafyphoto' }, mimeType: 'image/jpeg', size: 1 },
			alt: 'A Bushwick rooftop at dusk',
			aspectRatio: { width: 3, height: 2 },
			createdAt: '2026-09-17T20:44:19.147Z'
		},
		'fm.plyr.track': { title: 'tachycardia 028', createdAt: '2026-08-25T23:53:12Z' }
	}[url.searchParams.get('collection') ?? ''];
	return Response.json({ records: [{ uri: 'at://x', cid: 'c', value }] });
});

// every load reads the rail's newest items, and tests never touch the network
vi.stubGlobal('fetch', pds);

describe('root layout load', () => {
	it('gives the marquee every topic, most recently written about first', async () => {
		const data = await load({} as LoadEvent);
		if (!data) throw new Error('load() returned nothing');
		expect(data.topics).toEqual(['AT Protocol', 'Node.js', 'GitHub Actions', 'npm', 'TC39']);
	});

	it('puts the AT Tag naming the author on every page', async () => {
		const data = await load({} as LoadEvent);
		if (!data) throw new Error('load() returned nothing');
		expect(data.atTags).toEqual([
			{ name: 'at:me', content: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c' }
		]);
	});
});

describe('the rail’s newest items', () => {
	// a fresh module each time, so each test starts with an empty cache
	const freshLoad = async () => (await import('./+layout.server')).load;

	beforeEach(() => {
		vi.resetModules();
		pds.mockClear();
	});
	afterEach(() => vi.stubGlobal('fetch', pds));

	it('are read from the PDS once a build, for every page', async () => {
		const fresh = await freshLoad();
		const data = await fresh({} as LoadEvent);
		await fresh({} as LoadEvent);
		expect(data?.latest).toEqual({
			bnb: { kind: 'post', title: 'Is MDM', date: '2026-10-02T00:00:00.000Z' },
			camera: {
				kind: 'photo',
				image: {
					src: 'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:uashgn65n5z7aqwk5cbuba5c/bafyphoto@jpeg',
					alt: 'A Bushwick rooftop at dusk',
					width: 3,
					height: 2
				},
				date: '2026-09-17T20:44:19.147Z'
			},
			dj: { kind: 'mix', title: 'tachycardia 028', date: '2026-08-25T23:53:12Z' }
		});
		// the DID document and three collections, however many pages there are
		expect(pds.mock.calls.length).toBe(4);
	});

	it('are left out, without failing the build, when the PDS is down', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);
		const data = await (await freshLoad())({} as LoadEvent);
		expect(data?.latest).toEqual({});
	});
});

describe('root layout options', () => {
	it('prerenders every page as plain HTML, without client-side JavaScript', () => {
		expect(layout.prerender).toBe(true);
		expect(layout.csr).toBe(false);
		expect(layout.trailingSlash).toBe('always');
	});
});
