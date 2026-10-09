import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { thumbUrl } from '$lib/atproto';
import type { Photo, Portfolio } from '$lib/types';

const { get } = vi.hoisted(() => ({ get: vi.fn<() => Promise<Portfolio>>() }));
vi.mock('$lib/server/portfolio', () => ({ portfolio: { get }, REQUEST_TIMEOUT_MS: 8_000 }));

/** A solid red thumbnail, standing in for the CDN's. */
const RED = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#ff0000' } })
	.jpeg()
	.toBuffer();

const photo = (cid: string, extra: Partial<Photo> = {}): Photo => ({
	uri: `at://photo/${cid}`,
	cid,
	width: 3000,
	height: 2000,
	alt: '',
	date: '2026-08-20T16:17:13Z',
	posted: '2026-09-17T00:00:00Z',
	place: 'Bushwick, New York',
	camera: 'Sony α7R IV',
	lens: 'FE 50mm ƒ/1.4 GM',
	focal: '50mm',
	aperture: 'ƒ/1.4',
	shutter: '1/30',
	iso: 'ISO 2000',
	ev: 1.6,
	...extra
});

const portfolioOf = (photos: Photo[]): Portfolio => ({
	profile: { displayName: 'tierney cyren', description: '', avatarCid: null },
	photos,
	pds: 'https://pds.test'
});

const FINISHED = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
const STAND_IN = 'public, max-age=300';

const CDN = 'https://cdn.bsky.app/';
const realFetch = globalThis.fetch;

/**
 * A fresh copy of the route (nothing in memory) that reaches the CDN through
 * `cdn`. Anything else goes through, like satori loading its layout engine.
 */
async function freshRoute(cdn: () => Promise<Response>) {
	vi.stubGlobal(
		'fetch',
		vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
			String(input).startsWith(CDN) ? cdn() : realFetch(input, init)
		)
	);
	vi.resetModules();
	const { GET } = await import('./+server');
	return async () => {
		const response = await GET({} as Parameters<typeof GET>[0]);
		const png = Buffer.from(await response.arrayBuffer());
		const { width, height } = await sharp(png).metadata();
		// the middle of the card, where the photograph goes
		const { data } = await sharp(png)
			.extract({ left: 600, top: 350, width: 1, height: 1 })
			.raw()
			.toBuffer({ resolveWithObject: true });
		return {
			type: response.headers.get('content-type'),
			cacheControl: response.headers.get('cache-control'),
			size: `${width}×${height}`,
			showsPhoto: data[0] > 200 && data[1] < 60,
			png
		};
	};
}

const fetched = () =>
	vi
		.mocked(fetch)
		.mock.calls.map(([url]) => String(url))
		.filter((url) => url.startsWith(CDN));

describe('GET /og.png', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		get.mockReset();
	});

	it('sets the featured photograph under the name as a 1200×630 PNG, then serves it from memory', async () => {
		get.mockResolvedValue(
			portfolioOf([photo('portrait', { width: 2000, height: 3000 }), photo('landscape')])
		);
		const card = await freshRoute(async () => new Response(RED));

		const first = await card();
		expect(first).toMatchObject({
			type: 'image/png',
			cacheControl: FINISHED,
			size: '1200×630',
			showsPhoto: true
		});

		const again = await card();
		expect(again.png.equals(first.png)).toBe(true);
		// the newest landscape is featured, and its thumbnail was fetched once
		expect(fetched()).toEqual([thumbUrl('landscape')]);
	});

	it('draws a new card when another photograph is featured', async () => {
		get.mockResolvedValue(portfolioOf([photo('one')]));
		const card = await freshRoute(async () => new Response(RED));
		await card();

		get.mockResolvedValue(portfolioOf([photo('two'), photo('one')]));
		expect(await card()).toMatchObject({ cacheControl: FINISHED, showsPhoto: true });
		expect(fetched()).toEqual([thumbUrl('one'), thumbUrl('two')]);
	});

	it('stands in with a card in type, cached briefly, while the AT Protocol is down', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		get.mockRejectedValue(new Error('PDS down'));
		const card = await freshRoute(async () => new Response(RED));

		expect(await card()).toMatchObject({
			cacheControl: STAND_IN,
			size: '1200×630',
			showsPhoto: false
		});
		expect(fetched()).toEqual([]);
	});

	it('stands in while the image CDN is down, and draws the real card once it is back', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		get.mockResolvedValue(portfolioOf([photo('one')]));
		let up = false;
		const card = await freshRoute(async () =>
			up ? new Response(RED) : new Response('unavailable', { status: 503 })
		);

		expect(await card()).toMatchObject({ cacheControl: STAND_IN, showsPhoto: false });
		up = true;
		expect(await card()).toMatchObject({ cacheControl: FINISHED, showsPhoto: true });
	});

	it('is the card in type when there are no photographs yet', async () => {
		get.mockResolvedValue(portfolioOf([]));
		const card = await freshRoute(async () => new Response(RED));

		expect(await card()).toMatchObject({ cacheControl: FINISHED, showsPhoto: false });
		expect(fetched()).toEqual([]);
	});
});
