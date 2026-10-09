import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIXES } from '$lib/fixtures';

const get = vi.fn();
vi.mock('$lib/server/crate', () => ({ crate: { get }, REQUEST_TIMEOUT_MS: 8_000 }));

// the image CDN; satori loads its own WebAssembly with the real fetch
const cdn = vi.fn<typeof fetch>();
vi.mock('@bnb/kit/server', () => ({ fetchWithTimeout: () => cdn }));

/** A 1×1 PNG, standing in for the cover. */
const PIXEL = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
	'base64'
);

const { GET: handler } = await import('./+server');
const GET = () => handler({} as never);

/** The mixes, with a newest mix of their own, so each test starts with a card the cache hasn't seen. */
const crateWith = (name: string) => ({
	mixes: [
		{ ...MIXES[0], uri: `at://${name}`, image: `https://images.plyr.fm/images/${name}.png` },
		...MIXES.slice(1)
	]
});

describe('GET /og.png', () => {
	beforeEach(() => {
		cdn.mockImplementation(
			async () => new Response(PIXEL, { headers: { 'content-type': 'image/png' } })
		);
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		get.mockReset();
		cdn.mockReset();
	});

	it('draws the card with the newest cover, caches it, and lets CDNs keep it', async () => {
		get.mockResolvedValue(crateWith('first'));

		const response = await GET();
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=86400');
		const png = new Uint8Array(await response.arrayBuffer());
		expect(new TextDecoder().decode(png.subarray(1, 4))).toBe('PNG');
		expect(cdn).toHaveBeenCalledOnce();
		expect(String(cdn.mock.calls[0][0])).toBe(
			'https://images.plyr.fm/cdn-cgi/image/width=600,format=auto/images/first.png'
		);

		// the same newest mix: the card comes from memory, the cover isn't fetched again
		const again = new Uint8Array(await (await GET()).arrayBuffer());
		expect(again).toEqual(png);
		expect(cdn).toHaveBeenCalledOnce();

		// a new mix: a new card
		get.mockResolvedValue(crateWith('second'));
		await GET();
		expect(cdn).toHaveBeenCalledTimes(2);
	});

	it('serves a type-only card briefly when the PDS is down, and tries again next time', async () => {
		get.mockRejectedValue(new Error('PDS down'));

		const response = await GET();
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('public, max-age=60');
		expect(cdn).not.toHaveBeenCalled();

		get.mockResolvedValue(crateWith('back'));
		expect((await GET()).headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=86400');
	});

	it('doesn’t keep a card whose cover couldn’t be fetched', async () => {
		get.mockResolvedValue(crateWith('flaky'));
		cdn.mockResolvedValueOnce(new Response('down', { status: 503 }));

		expect((await GET()).headers.get('cache-control')).toBe('public, max-age=60');
		expect((await GET()).headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=86400');
		expect(cdn).toHaveBeenCalledTimes(2);
	});
});
