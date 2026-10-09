import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { thumbUrl } from '../atproto';

const MINUTE = 60_000;

/** A 32×16 frame (already sample-sized, so nothing blurs), three quarters red and a quarter blue. */
const frame = await sharp({
	create: { width: 32, height: 16, channels: 3, background: '#ff0000' }
})
	.composite([
		{
			input: { create: { width: 8, height: 16, channels: 3, background: '#0000ff' } },
			left: 24,
			top: 0
		}
	])
	.png()
	.toBuffer();

const RED_AND_BLUE = [
	{ hex: '#0000ff', share: 0.25 },
	{ hex: '#ff0000', share: 0.75 }
];

/** A fresh copy of the module (an empty cache) that fetches through `network`. */
async function freshPalettes(network: (url: string) => Promise<Response>) {
	vi.stubGlobal('fetch', vi.fn(network));
	vi.resetModules();
	return (await import('./palette')).palettesFor;
}

const fetched = () => vi.mocked(fetch).mock.calls.map(([url]) => String(url));

describe('palettesFor', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-09T12:00:00Z') });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('answers at once, reads missing palettes in the background, then serves them from memory', async () => {
		const palettesFor = await freshPalettes(async () => new Response(frame));

		expect(palettesFor(['cid-a'])).toEqual({});
		await vi.waitFor(() => expect(palettesFor(['cid-a'])).toEqual({ 'cid-a': RED_AND_BLUE }));
		expect(palettesFor(['cid-a', 'cid-a'])).toEqual({ 'cid-a': RED_AND_BLUE });
		expect(fetched()).toEqual([thumbUrl('cid-a')]);
	});

	it('reads each thumbnail once, however many renders ask for it meanwhile', async () => {
		const palettesFor = await freshPalettes(async () => new Response(frame));

		palettesFor(['cid-a', 'cid-b']);
		palettesFor(['cid-b', 'cid-a']);
		await vi.waitFor(() => expect(Object.keys(palettesFor(['cid-a', 'cid-b']))).toHaveLength(2));
		expect(fetched().toSorted()).toEqual([thumbUrl('cid-a'), thumbUrl('cid-b')]);
	});

	it('reads no more than four thumbnails at a time', async () => {
		const held: Array<() => void> = [];
		const palettesFor = await freshPalettes(
			() => new Promise((resolve) => held.push(() => resolve(new Response(frame))))
		);
		const cids = ['a', 'b', 'c', 'd', 'e', 'f'];

		palettesFor(cids);
		expect(fetched()).toHaveLength(4);

		held.shift()?.();
		await vi.waitFor(() => expect(fetched()).toHaveLength(5));
		while (held.length) held.shift()?.();
		await vi.waitFor(() => expect(fetched()).toHaveLength(6));
		held.shift()?.();
		await vi.waitFor(() => expect(Object.keys(palettesFor(cids))).toHaveLength(6));
	});

	it('leaves a photograph without colours when its thumbnail fails, and tries again ten minutes on', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		let status = 502;
		const palettesFor = await freshPalettes(async () =>
			status === 200 ? new Response(frame) : new Response('busy', { status })
		);

		palettesFor(['cid-a']);
		await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
		expect(String(error.mock.calls[0][1])).toContain('502');

		status = 200;
		vi.setSystemTime(Date.now() + 9 * MINUTE);
		expect(palettesFor(['cid-a'])).toEqual({});
		expect(fetched()).toHaveLength(1);

		vi.setSystemTime(Date.now() + MINUTE);
		palettesFor(['cid-a']);
		await vi.waitFor(() => expect(palettesFor(['cid-a'])).toEqual({ 'cid-a': RED_AND_BLUE }));
		expect(fetched()).toHaveLength(2);
	});
});
