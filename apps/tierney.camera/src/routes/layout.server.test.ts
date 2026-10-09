import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type LoadEvent = Parameters<typeof import('./+layout.server').load>[0];

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

// a fresh module each time, so each test starts with an empty cache
const load = async () => (await import('./+layout.server')).load({} as LoadEvent);

describe('root layout load', () => {
	beforeEach(() => vi.resetModules());
	afterEach(() => vi.unstubAllGlobals());

	it('gives the rail each site’s newest item, read from the PDS', async () => {
		vi.stubGlobal('fetch', pds);
		await expect(load()).resolves.toEqual({
			latest: {
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
			}
		});
	});

	it('still loads, with nothing for the rail, when the PDS is down', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);
		await expect(load()).resolves.toEqual({ latest: {} });
	});
});
