import type { ComponentProps } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { Photo } from '../types';
import PhotoFigure from './PhotoFigure.svelte';

const HEART = /^Like/;

// a tiny in-page image stands in for the CDN, so nothing touches the network
const { stub } = vi.hoisted(() => ({
	stub: (label: string) =>
		`data:image/svg+xml,${encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000"><title>${label}</title></svg>`
		)}`
}));
vi.mock('../atproto', async (importOriginal) => ({
	...(await importOriginal<typeof import('../atproto')>()),
	thumbUrl: (cid: string) => stub(`thumb ${cid}`),
	fullUrl: (cid: string) => stub(`full ${cid}`),
	blobUrl: (_pds: string, cid: string) => stub(`blob ${cid}`)
}));

function photo(extra: Partial<Photo> = {}): Photo {
	return {
		uri: 'at://photo/1',
		cid: 'cid-1',
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

async function show(props: Partial<ComponentProps<typeof PhotoFigure>> = {}) {
	const onopen = vi.fn();
	const view = await render(PhotoFigure, {
		photo: photo(),
		index: 2,
		pds: 'https://pds.test',
		onopen,
		...props
	});
	const figure = view.container.querySelector('figure')!;
	const img = figure.querySelector('img')!;
	const caption = figure.querySelector('figcaption')!;
	return { ...view, onopen, figure, img, caption };
}

/** The caption text that's actually on screen (one of its long or short forms). */
function visibleText(caption: Element, form: 'long' | 'short'): string[] {
	return [...caption.querySelectorAll(`.${form}`)]
		.filter((el) => el.checkVisibility())
		.map((el) => el.textContent ?? '');
}

describe('PhotoFigure (component)', () => {
	afterEach(() => {
		document.querySelector('.spacer')?.remove();
	});

	it('opens the photograph from a labelled button', async () => {
		const { onopen, img } = await show();

		const button = page.getByRole('button', { name: 'Open photograph 03, Bushwick, New York' });
		await button.click();
		expect(onopen).toHaveBeenCalledOnce();
		expect(img.alt).toBe('Photograph, Bushwick, New York');
	});

	it('uses the photograph’s own alt text when it has some', async () => {
		const { img } = await show({ photo: photo({ alt: 'A crowd under red light' }) });
		expect(img.alt).toBe('A crowd under red light');
	});

	it('falls back to "Untitled" and a plain label without a place', async () => {
		const { img, caption } = await show({ photo: photo({ place: '' }) });

		await expect
			.element(page.getByRole('button', { name: 'Open photograph 03', exact: true }))
			.toBeInTheDocument();
		expect(img.alt).toBe('Photograph');
		expect(visibleText(caption, 'long')).toEqual([
			'Untitled · 07.09.26',
			'50mm ƒ/1.4 1/80 ISO 12800'
		]);
	});

	it('captions with the frame number, place, date and exposure', async () => {
		const { caption } = await show();

		expect(caption.querySelector('.n')?.textContent).toBe('03');
		expect(visibleText(caption, 'long')).toEqual([
			'Bushwick, NY · 07.09.26',
			'50mm ƒ/1.4 1/80 ISO 12800'
		]);
		expect(visibleText(caption, 'short')).toEqual([]);
		// ƒ stays lowercase in the uppercase caption
		expect(caption.querySelector('.spec .f')).not.toBeNull();
	});

	it('switches to the short caption when the figure is narrow', async () => {
		const { container, caption } = await show();
		container.style.width = '200px';

		await vi.waitFor(() =>
			expect(visibleText(caption, 'short')).toEqual(['07.09.26', 'ƒ/1.4 ISO 12800'])
		);
		expect(visibleText(caption, 'long')).toEqual([]);
	});

	it('leaves out the exposure when there is none', async () => {
		const { caption } = await show({
			photo: photo({ focal: '', aperture: '', shutter: '', iso: '', ev: null, date: '' })
		});
		expect(caption.querySelector('.spec')).toBeNull();
		expect(visibleText(caption, 'long')).toEqual(['Bushwick, NY']);
	});

	it('keeps its aspect ratio, and joins a justified row once fitted', async () => {
		const { figure, rerender } = await show();
		expect(figure.style.getPropertyValue('--ar')).toBe('1.5');
		expect(figure.classList.contains('fitted')).toBe(false);
		expect(figure.style.getPropertyValue('--share')).toBe('');

		await rerender({ fit: { share: 0.25, count: 3 } });
		expect(figure.classList.contains('fitted')).toBe(true);
		expect(figure.style.getPropertyValue('--share')).toBe('0.25');
		expect(figure.style.getPropertyValue('--count')).toBe('3');
		expect(figure.dataset.index).toBe('2');
	});

	it('runs full width as a feature frame', async () => {
		const { figure } = await show({ feature: true, fit: null });
		expect(figure.classList.contains('feature')).toBe(true);
		expect(figure.classList.contains('fitted')).toBe(false);
	});

	it('shows the frame as loaded once its image arrives', async () => {
		await show();
		await expect.element(page.getByRole('button')).toHaveClass('loaded');
	});

	it('loads above-the-fold photographs eagerly and shows them at once', async () => {
		const { figure, img } = await show({ priority: true });
		expect(figure.classList.contains('in')).toBe(true);
		expect(img.loading).toBe('eager');
		expect(img.getAttribute('fetchpriority')).toBe('high');
	});

	it('reveals a lazy photograph once it scrolls into view', async () => {
		const spacer = document.createElement('div');
		spacer.className = 'spacer';
		spacer.style.height = '4000px';
		document.body.prepend(spacer);

		const { figure, img } = await show();
		expect(img.loading).toBe('lazy');
		expect(img.getAttribute('fetchpriority')).toBe('auto');
		await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));
		expect(figure.classList.contains('in')).toBe(false);

		figure.scrollIntoView({ block: 'center' });
		await vi.waitFor(() => expect(figure.classList.contains('in')).toBe(true));
	});

	it('shows its colours as a strip under the caption, each as wide as its share', async () => {
		const { caption } = await show({
			palette: [
				{ hex: '#0b041a', share: 0.75 },
				{ hex: '#d7ff3a', share: 0.25 }
			]
		});
		const strip = caption.querySelector('.strip')!;
		expect(strip.getAttribute('aria-hidden')).toBe('true');
		const swatches = Array.from(strip.children, (swatch) => getComputedStyle(swatch));
		expect(swatches.map((style) => style.backgroundColor)).toEqual([
			'rgb(11, 4, 26)',
			'rgb(215, 255, 58)'
		]);
		const [dark, acid] = Array.from(
			strip.children,
			(swatch) => swatch.getBoundingClientRect().width
		);
		expect(dark / acid).toBeCloseTo(3);
	});

	it('has a heart for its gallery, with how many people have liked it', async () => {
		await show({
			photo: photo({ gallery: 'at://did:plc:author/social.grain.gallery/3lbushwick' }),
			likes: { 'at://did:plc:author/social.grain.gallery/3lbushwick': 4 }
		});
		await expect
			.element(page.getByRole('button', { name: 'Like photograph 03, 4 likes' }))
			.toHaveAttribute('aria-pressed', 'false');
	});

	it('has no heart without a gallery to like', async () => {
		await show();
		await expect.element(page.getByRole('button', { name: HEART })).not.toBeInTheDocument();
	});

	it('keeps room for the strip before its colours are ready, so nothing moves when they arrive', async () => {
		const { caption } = await show();
		const strip = caption.querySelector('.strip')!;
		expect(strip.children).toHaveLength(0);
		expect(strip.getBoundingClientRect().height).toBe(4);
	});
});
