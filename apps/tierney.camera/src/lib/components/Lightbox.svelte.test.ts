import type { ComponentProps } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { fullUrl, thumbUrl } from '../atproto';
import type { Photo } from '../types';
import Lightbox from './Lightbox.svelte';

// In-page SVGs stand in for the CDN, so the images really load (and sharpen)
// without the network: a 3×2 thumbnail and a 3000×2000 full size. Each is a
// blob: url made once, so like a real image it loads asynchronously the first
// time and from the memory cache after that.
vi.mock('../atproto', async (importOriginal) => {
	const atproto = await importOriginal<typeof import('../atproto')>();
	const made = new Map<string, string>();
	const image = (width: number, height: number, label: string) => {
		let url = made.get(label);
		if (!url) {
			const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`;
			url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
			made.set(label, url);
		}
		return url;
	};
	return {
		...atproto,
		thumbUrl: (cid: string) => image(3, 2, `thumb ${cid}`),
		fullUrl: (cid: string) => image(3000, 2000, `full ${cid}`),
		blobUrl: (_pds: string, cid: string) => image(3000, 2000, `blob ${cid}`)
	};
});

function photo(n: number, extra: Partial<Photo> = {}): Photo {
	return {
		uri: `at://photo/${n}`,
		cid: `cid-${n}`,
		width: 3000,
		height: 2000,
		alt: '',
		date: '2026-07-09T14:00:50Z',
		posted: '2026-09-17T00:00:00Z',
		place: 'Bushwick, New York',
		camera: 'Sony α7R IV',
		lens: 'FE 50mm ƒ/1.4 GM',
		focal: '50mm',
		aperture: 'ƒ/1.4',
		shutter: '1/80',
		iso: 'ISO 12800',
		ev: 0.3,
		...extra
	};
}

const photos = [photo(1), photo(2, { place: 'Ridgewood, New York', date: '2026-08-20T10:00:00Z' })];

async function open(props: Partial<ComponentProps<typeof Lightbox>> = {}) {
	const onclose = vi.fn();
	const onnav = vi.fn();
	const view = await render(Lightbox, {
		photos,
		pds: 'https://pds.test',
		index: 0,
		onclose,
		onnav,
		...props
	});
	const dialog = () => view.container.querySelector('dialog');
	const img = () => view.container.querySelector<HTMLImageElement>('dialog img')!;
	return { ...view, onclose, onnav, dialog, img };
}

/** Fires a touch event on `target` at `clientX` (one finger unless told otherwise). */
function touch(target: Element, type: 'touchstart' | 'touchend', clientX: number, fingers = 1) {
	const points = Array.from(
		{ length: fingers },
		(_, identifier) => new Touch({ identifier, target, clientX: clientX + identifier * 100 })
	);
	target.dispatchEvent(
		new TouchEvent(type, {
			bubbles: true,
			touches: type === 'touchstart' ? points : [],
			changedTouches: points
		})
	);
}

afterEach(async () => {
	vi.restoreAllMocks();
	// vitest's default viewport, for the tests that widen it
	await page.viewport(414, 896);
});

describe('Lightbox (component)', () => {
	it('opens as a focused modal dialog with a frame counter', async () => {
		const { dialog } = await open();

		await expect
			.element(page.getByRole('dialog', { name: 'Photograph viewer' }))
			.toBeInTheDocument();
		expect(dialog()?.open).toBe(true);
		expect(dialog()?.matches(':modal')).toBe(true);
		expect(document.activeElement).toBe(dialog());
		await expect.element(page.getByText('01 / 02')).toBeVisible();
	});

	it('counts the frame it is showing', async () => {
		await open({ index: 1 });
		await expect.element(page.getByText('02 / 02')).toBeVisible();
		await expect.element(page.getByText('Ridgewood, New York')).toBeVisible();
	});

	it('renders nothing for an index outside the set', async () => {
		const { container, rerender } = await open({ index: -1 });
		expect(container.querySelector('dialog')).toBeNull();
		expect(document.body.style.overflow).toBe('');

		await rerender({ index: photos.length });
		expect(container.querySelector('dialog')).toBeNull();
		expect(document.body.style.overflow).toBe('');
	});

	it('pages with the arrow keys', async () => {
		const { onnav } = await open();

		await userEvent.keyboard('{ArrowRight}');
		expect(onnav).toHaveBeenLastCalledWith(1);
		await userEvent.keyboard('{ArrowLeft}');
		expect(onnav).toHaveBeenLastCalledWith(-1);
		await userEvent.keyboard('{ArrowUp}a');
		expect(onnav).toHaveBeenCalledTimes(2);
	});

	it('pages with the on-screen arrows on a wide screen', async () => {
		await page.viewport(1280, 800);
		const { onnav } = await open();

		await page.getByRole('button', { name: 'Next photograph' }).click();
		expect(onnav).toHaveBeenLastCalledWith(1);
		await page.getByRole('button', { name: 'Previous photograph' }).click();
		expect(onnav).toHaveBeenLastCalledWith(-1);
	});

	it('closes on Escape', async () => {
		const { onclose, dialog } = await open();

		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(onclose).toHaveBeenCalledOnce());
		expect(dialog()?.open).toBe(false);
	});

	it('closes from the Close button', async () => {
		const { onclose } = await open();

		await page.getByRole('button', { name: 'Close' }).click();
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('closes on a click on the backdrop, but not on the photograph', async () => {
		await page.viewport(1280, 800);
		const { onclose, container, img } = await open();

		await page.elementLocator(img()).click();
		expect(onclose).not.toHaveBeenCalled();

		// the stage's padding, around the photograph
		const stage = container.querySelector('.stage')!;
		await page.elementLocator(stage).click({ position: { x: 4, y: 4 } });
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('pages with a swipe of at least 48px', async () => {
		const { onnav, dialog } = await open();
		const target = dialog()!;

		// swipe left → next
		touch(target, 'touchstart', 300);
		touch(target, 'touchend', 240);
		expect(onnav).toHaveBeenLastCalledWith(1);

		// swipe right → previous
		touch(target, 'touchstart', 100);
		touch(target, 'touchend', 148);
		expect(onnav).toHaveBeenLastCalledWith(-1);
		expect(onnav).toHaveBeenCalledTimes(2);

		// too short to count
		touch(target, 'touchstart', 300);
		touch(target, 'touchend', 253);
		// two fingers are a pinch, not a swipe
		touch(target, 'touchstart', 300, 2);
		touch(target, 'touchend', 100, 2);
		// a touchend with no touchstart before it
		touch(target, 'touchend', 0);
		expect(onnav).toHaveBeenCalledTimes(2);
	});

	it('keeps Tab within the controls, wrapping at either end', async () => {
		await page.viewport(1280, 800);
		const { dialog } = await open();
		const close = page.getByRole('button', { name: 'Close' });
		const previous = page.getByRole('button', { name: 'Previous photograph' });
		const next = page.getByRole('button', { name: 'Next photograph' });

		// from the dialog itself, Tab enters at the first control
		expect(document.activeElement).toBe(dialog());
		await userEvent.tab();
		await expect.element(close).toHaveFocus();
		await userEvent.tab();
		await expect.element(previous).toHaveFocus();
		await userEvent.tab();
		await expect.element(next).toHaveFocus();
		await userEvent.tab();
		await expect.element(close).toHaveFocus();
		await userEvent.tab({ shift: true });
		await expect.element(next).toHaveFocus();
	});

	it('enters at the last control on Shift+Tab', async () => {
		await page.viewport(1280, 800);
		await open();

		await userEvent.tab({ shift: true });
		await expect.element(page.getByRole('button', { name: 'Next photograph' })).toHaveFocus();
	});

	it('skips the arrows when a narrow screen hides them', async () => {
		await page.viewport(414, 896);
		await open();
		const close = page.getByRole('button', { name: 'Close' });

		await userEvent.tab();
		await expect.element(close).toHaveFocus();
		await userEvent.tab();
		await expect.element(close).toHaveFocus();
		await userEvent.tab({ shift: true });
		await expect.element(close).toHaveFocus();
	});

	it('shows the place, date, exposure and gear', async () => {
		const { container, img } = await open();

		await expect.element(page.getByText('Bushwick, New York')).toBeVisible();
		await expect.element(page.getByText('Jul 9, 2026')).toBeVisible();
		expect(container.querySelector('.exposure')?.textContent).toBe('50mm·ƒ/1.4·1/80·ISO 12800');
		expect(container.querySelector('.gear')?.textContent).toBe('Sony α7R IV  ·  FE 50mm ƒ/1.4 GM');
		expect(img().alt).toBe('Photograph, Bushwick, New York');
	});

	it('leaves out whatever exif is missing', async () => {
		const sparse = photo(1, { focal: '', shutter: '', ev: null, camera: '', lens: '' });
		const { container } = await open({ photos: [sparse] });
		expect(container.querySelector('.exposure')?.textContent).toBe('ƒ/1.4·ISO 12800');
		expect(container.querySelector('.gear')).toBeNull();
	});

	it('leaves out the exposure line when there is none', async () => {
		const bare = photo(1, { focal: '', aperture: '', shutter: '', iso: '', ev: null, camera: '' });
		const { container } = await open({ photos: [bare] });
		expect(container.querySelector('.exposure')).toBeNull();
		expect(container.querySelector('.gear')?.textContent).toBe('FE 50mm ƒ/1.4 GM');
	});

	it('falls back to "Untitled" and a plain alt without a place', async () => {
		const { container, img } = await open({
			photos: [photo(1, { place: '', date: '' })]
		});

		expect(container.querySelector('.place')?.textContent).toBe('Untitled');
		expect(container.querySelector('.date')?.textContent).toBe('');
		expect(img().alt).toBe('Photograph');
	});

	it('prefers the photograph’s own alt text', async () => {
		const { img } = await open({ photos: [photo(1, { alt: 'A crowd under red light' })] });
		expect(img().alt).toBe('A crowd under red light');
	});

	it('fades the thumbnail in once it loads, then sharpens it', async () => {
		// a photograph this document hasn't loaded yet
		const { img } = await open({ photos: [photo(7)] });

		expect(img().getAttribute('src')).toBe(thumbUrl('cid-7'));
		await expect.element(img()).toHaveClass('ready');
		// the stage is far wider than the 3px thumbnail, so the full size swaps in
		await vi.waitFor(() => expect(img().getAttribute('src')).toBe(fullUrl('cid-7')));
	});

	it('fades each photograph in afresh as it pages, and sharpens it', async () => {
		const { img, rerender } = await open({ photos: [photo(8), photo(9)] });
		await expect.element(img()).toHaveClass('ready');

		const classes: boolean[] = [];
		const watcher = new MutationObserver(() => classes.push(img().classList.contains('ready')));
		watcher.observe(img(), { attributeFilter: ['class'] });

		await rerender({ index: 1 });
		await expect.element(page.getByText('02 / 02')).toBeVisible();
		await vi.waitFor(() => expect(img().getAttribute('src')).toBe(fullUrl('cid-9')));
		await expect.element(img()).toHaveClass('ready');
		watcher.disconnect();

		// it dropped back to unloaded before the next photograph faded in
		expect(classes[0]).toBe(false);
		expect(classes.at(-1)).toBe(true);
	});

	it("warms both neighbours' thumbnails, wrapping around the ends", async () => {
		const src = vi.spyOn(HTMLImageElement.prototype, 'src', 'set');
		const three = [photo(1), photo(2), photo(3)];
		await open({ photos: three, index: 0 });

		const requested = src.mock.calls.map(([url]) => url);
		expect(requested).toContain(thumbUrl('cid-2'));
		expect(requested).toContain(thumbUrl('cid-3'));
	});

	it('locks the page while open and hands focus back to the opener on close', async () => {
		const opener = document.createElement('button');
		opener.textContent = 'Open photograph 01';
		document.body.append(opener);
		document.body.style.overflow = 'auto';

		try {
			const { rerender, dialog } = await open({ index: -1 });
			opener.focus();

			await rerender({ index: 0 });
			expect(dialog()?.open).toBe(true);
			expect(document.activeElement).toBe(dialog());
			expect(document.body.style.overflow).toBe('hidden');

			await rerender({ index: -1 });
			expect(dialog()).toBeNull();
			expect(document.activeElement).toBe(opener);
			expect(document.body.style.overflow).toBe('auto');
		} finally {
			opener.remove();
			document.body.style.overflow = '';
		}
	});

	it('stops listening for keys once closed', async () => {
		const { rerender, onnav } = await open();
		await rerender({ index: -1 });

		await userEvent.keyboard('{ArrowRight}');
		expect(onnav).not.toHaveBeenCalled();
	});

	it('meters the light in the photograph', async () => {
		await open();
		const meter = page.getByRole('meter', { name: 'Light meter' });
		await expect.element(meter).toHaveAttribute('aria-valuetext', 'EV 0.3, low light');
		await expect.element(page.getByText('EV 0.3')).toBeVisible();
	});

	it('leaves the meter out without aperture, shutter and ISO to read', async () => {
		await open({ photos: [photo(1, { shutter: '', ev: null })] });
		await expect.element(page.getByRole('dialog')).toBeVisible();
		await expect.element(page.getByRole('meter')).not.toBeInTheDocument();
	});

	it("shows the photograph's colours under its place and date, once they're ready", async () => {
		const { container, rerender } = await open();
		expect(container.querySelector('.caption .strip')?.children).toHaveLength(0);

		await rerender({ palettes: { 'cid-1': [{ hex: '#d7ff3a', share: 1 }] } });
		const swatch = container.querySelector('.caption .strip > *');
		expect(swatch && getComputedStyle(swatch).backgroundColor).toBe('rgb(215, 255, 58)');
	});

	it('has a heart beside Close for a photograph with a gallery', async () => {
		await open({
			photos: [
				photo(1, { gallery: 'at://did:plc:author/social.grain.gallery/3lbushwick' }),
				photo(2)
			],
			likes: { 'at://did:plc:author/social.grain.gallery/3lbushwick': 2 }
		});
		await expect
			.element(page.getByRole('button', { name: 'Like photograph 01, 2 likes' }))
			.toBeVisible();
	});

	it('leaves the keys to the sign-in dialog opened over it', async () => {
		const { onnav, onclose, dialog } = await open({
			photos: [
				photo(1, { gallery: 'at://did:plc:author/social.grain.gallery/3lbushwick' }),
				photo(2)
			]
		});
		await page.getByRole('button', { name: 'Like photograph 01' }).click();
		const signIn = page.getByRole('dialog', { name: 'Sign in to like' });
		await expect.element(signIn.getByRole('textbox')).toHaveFocus();

		await userEvent.keyboard('{ArrowRight}{ArrowLeft}');
		expect(onnav).not.toHaveBeenCalled();
		await userEvent.keyboard('{Escape}');
		await expect.element(signIn).not.toBeInTheDocument();
		expect(onclose).not.toHaveBeenCalled();
		expect(dialog()?.open).toBe(true);
	});
});
