import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { resilient, sharpen } from './image';

// The attachments run on real <img> elements in Chromium. Every image is a data:
// URL, so loads and failures are real but nothing touches the network.

/** An SVG of `width` × `height` pixels; `label` keeps otherwise identical urls apart. */
function svg(width: number, height: number, label: string): string {
	const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><title>${label}</title></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

/** A data: URL that never decodes, so the image fails without a request. */
function broken(label: string): string {
	return `data:image/png;base64,${btoa(`not a png: ${label}`)}`;
}

const attached: HTMLImageElement[] = [];

/** A block-level <img> in the document, drawn `width` css pixels wide. */
function image(width = 100): HTMLImageElement {
	const img = document.createElement('img');
	img.alt = '';
	img.style.display = 'block';
	img.style.width = `${width}px`;
	document.body.append(img);
	attached.push(img);
	return img;
}

/** Resolves once the image next finishes loading or failing. */
function settled(img: HTMLImageElement): Promise<void> {
	return new Promise((resolve) => {
		img.addEventListener('load', () => resolve(), { once: true });
		img.addEventListener('error', () => resolve(), { once: true });
	});
}

/** Points the image at `src` and waits for the outcome. */
async function show(img: HTMLImageElement, src: string): Promise<void> {
	const done = settled(img);
	img.src = src;
	await done;
}

/** Lets pending image tasks and promise callbacks run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

afterEach(() => {
	for (const img of attached.splice(0)) img.remove();
	vi.restoreAllMocks();
});

describe('resilient', () => {
	it('moves through the fallbacks in order until one loads, then calls onready', async () => {
		const img = image();
		const failed: string[] = [];
		img.addEventListener('error', () => failed.push(img.src));
		const onready = vi.fn();
		const first = broken('first fallback');
		const good = svg(4, 3, 'second fallback');

		resilient([first, good], onready)(img);
		img.src = broken('original');

		await vi.waitFor(() => expect(onready).toHaveBeenCalledOnce());
		expect(img.src).toBe(good);
		expect(failed).toEqual([broken('original'), first]);
	});

	it('drops a failing srcset, which would otherwise win over the fallback', async () => {
		const img = image();
		const onready = vi.fn();
		const good = svg(4, 3, 'original');

		resilient([good], onready)(img);
		img.srcset = `${broken('resized')} 600w`;
		img.src = broken('resized src');

		await vi.waitFor(() => expect(onready).toHaveBeenCalledOnce());
		expect(img.hasAttribute('srcset')).toBe(false);
		expect(img.currentSrc).toBe(good);
	});

	it('stays on the last fallback once every source has failed', async () => {
		const img = image();
		let failures = 0;
		img.addEventListener('error', () => failures++);
		const onready = vi.fn();
		const last = broken('last');

		resilient([broken('first'), last], onready)(img);
		img.src = broken('original');

		await vi.waitFor(() => expect(failures).toBe(3));
		await flush();
		expect(failures).toBe(3);
		expect(img.src).toBe(last);
		expect(onready).not.toHaveBeenCalled();
	});

	it('picks up an image that had already loaded before it was attached', async () => {
		const img = image();
		const good = svg(4, 3, 'server-rendered');
		await show(img, good);

		const onready = vi.fn();
		resilient([broken('unused')], onready)(img);

		expect(onready).toHaveBeenCalledOnce();
		expect(img.src).toBe(good);
	});

	it('recovers an image that had already failed before it was attached', async () => {
		const img = image();
		await show(img, broken('server-rendered'));
		expect(img.complete).toBe(true);

		const onready = vi.fn();
		const good = svg(4, 3, 'fallback');
		resilient([good], onready)(img);

		// the swap happens straight away, without waiting for another error
		expect(img.src).toBe(good);
		await vi.waitFor(() => expect(onready).toHaveBeenCalledOnce());
	});

	it('leaves an image that has not started loading alone', async () => {
		const img = image();
		const onready = vi.fn();

		resilient([svg(4, 3, 'fallback')], onready)(img);
		await flush();

		expect(img.getAttribute('src')).toBeNull();
		expect(onready).not.toHaveBeenCalled();
	});

	it('stops listening once detached', async () => {
		const img = image();
		const onready = vi.fn();
		const detach = resilient([svg(4, 3, 'fallback')], onready)(img);
		detach?.();

		const bad = broken('after detach');
		await show(img, bad);
		await flush();
		expect(img.src).toBe(bad);

		await show(img, svg(4, 3, 'loads fine'));
		expect(onready).not.toHaveBeenCalled();
	});

	it('works without an onready callback', async () => {
		const img = image();
		const good = svg(4, 3, 'fallback');
		resilient([good])(img);

		await show(img, broken('original'));
		await vi.waitFor(() => expect(img.src).toBe(good));
		await vi.waitFor(() => expect(img.naturalWidth).toBe(4));
	});
});

describe('sharpen', () => {
	let decode: MockInstance<HTMLImageElement['decode']>;
	/** the urls sharpen() has probed, in order */
	const probed = () => decode.mock.contexts.map((probe) => (probe as HTMLImageElement).src);

	beforeEach(() => {
		decode = vi.spyOn(HTMLImageElement.prototype, 'decode');
	});

	const thumb = svg(4, 3, 'thumbnail');

	it('swaps in the first candidate that loads when the image is drawn larger than its pixels', async () => {
		const img = image(200);
		await show(img, thumb);

		const failing = broken('full size, timed out');
		const sharp = svg(800, 600, 'raw blob');
		const spare = svg(1600, 1200, 'never needed');
		sharpen([failing, sharp, spare])(img);

		await vi.waitFor(() => expect(img.src).toBe(sharp));
		expect(probed()).toEqual([failing, sharp]);
	});

	it('waits for the image to load first, and sharpens only once', async () => {
		const img = image(200);
		let loads = 0;
		img.addEventListener('load', () => loads++);
		const sharp = svg(800, 600, 'sharp');

		sharpen([sharp, svg(1600, 1200, 'spare')])(img);
		expect(decode).not.toHaveBeenCalled();

		img.src = thumb;
		await vi.waitFor(() => expect(img.src).toBe(sharp));
		// the sharper source's own load doesn't start another round
		await vi.waitFor(() => expect(loads).toBe(2));
		await flush();
		expect(probed()).toEqual([sharp]);
	});

	it('leaves an image alone when it already has enough pixels for its size', async () => {
		const img = image(100);
		const large = svg(4000, 3000, 'already sharp');
		await show(img, large);

		sharpen([svg(8000, 6000, 'sharper')])(img);
		await flush();

		expect(decode).not.toHaveBeenCalled();
		expect(img.src).toBe(large);
	});

	it('does not swap when detached while a candidate is loading', async () => {
		const img = image(200);
		await show(img, thumb);

		const detach = sharpen([svg(800, 600, 'sharp')])(img);
		expect(decode).toHaveBeenCalledOnce();
		detach?.();

		await decode.mock.results[0].value;
		await flush();
		expect(img.src).toBe(thumb);
	});

	it('stops trying further candidates once detached', async () => {
		const img = image(200);
		await show(img, thumb);

		const detach = sharpen([broken('first'), svg(800, 600, 'second')])(img);
		detach?.();

		await (decode.mock.results[0].value as Promise<void>).catch(() => {});
		await flush();
		expect(decode).toHaveBeenCalledOnce();
		expect(img.src).toBe(thumb);
	});

	it('does nothing when detached before the image has loaded', async () => {
		const img = image(200);
		const detach = sharpen([svg(800, 600, 'sharp')])(img);
		detach?.();

		await show(img, thumb);
		await flush();
		expect(decode).not.toHaveBeenCalled();
		expect(img.src).toBe(thumb);
	});
});
