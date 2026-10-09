import type { ComponentProps } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { Photo } from '../types';
import Feature from './Feature.svelte';

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

async function show(props: Partial<ComponentProps<typeof Feature>> = {}) {
	const onopen = vi.fn();
	const view = await render(Feature, {
		photo: photo(),
		index: 0,
		pds: 'https://pds.test',
		onopen,
		...props
	});
	return { ...view, onopen, img: view.container.querySelector('img')! };
}

describe('Feature (component)', () => {
	it('opens the featured photograph from a labelled button', async () => {
		const { onopen, img } = await show();

		await expect
			.element(page.getByRole('region', { name: 'Featured photograph' }))
			.toBeInTheDocument();
		await page.getByRole('button', { name: 'Open photograph 01, Bushwick, New York' }).click();
		expect(onopen).toHaveBeenCalledOnce();
		expect(img.alt).toBe('Photograph, Bushwick, New York');
	});

	it('loads its image eagerly, at high priority', async () => {
		const { img } = await show();
		expect(img.loading).toBe('eager');
		expect(img.getAttribute('fetchpriority')).toBe('high');
	});

	it('captions with the frame number, place, date and exposure', async () => {
		const { container } = await show({ index: 4 });
		const caption = container.querySelector('figcaption')!;

		expect(caption.querySelector('.n')?.textContent).toBe('05');
		expect(caption.firstElementChild?.textContent).toBe('05Bushwick, NY · 07.09.26');
		expect(caption.querySelector('.spec')?.textContent).toBe('50mm ƒ/1.4 1/80 ISO 12800');
		expect(caption.querySelector('.spec .f')).not.toBeNull();
	});

	it('copes with a photograph that has no place or exif', async () => {
		const { container, img } = await show({
			photo: photo({
				place: '',
				alt: 'Hands on the decks',
				focal: '',
				aperture: '',
				shutter: '',
				iso: '',
				ev: null
			})
		});

		await expect
			.element(page.getByRole('button', { name: 'Open photograph 01', exact: true }))
			.toBeInTheDocument();
		expect(img.alt).toBe('Hands on the decks');
		expect(container.querySelector('figcaption')?.firstElementChild?.textContent).toBe(
			'0107.09.26'
		);
		expect(container.querySelector('.spec')).toBeNull();
	});

	it('says "Photograph" when there is neither alt text nor a place', async () => {
		const { img } = await show({ photo: photo({ place: '' }) });
		expect(img.alt).toBe('Photograph');
	});

	it('has a heart for its gallery in the caption, and none without one', async () => {
		const { rerender } = await show({
			photo: photo({ gallery: 'at://did:plc:author/social.grain.gallery/3lbushwick' }),
			likes: { 'at://did:plc:author/social.grain.gallery/3lbushwick': 1 }
		});
		await expect
			.element(page.getByRole('button', { name: 'Like photograph 01, 1 like' }))
			.toBeVisible();
		await rerender({ photo: photo() });
		await expect.element(page.getByRole('button', { name: HEART })).not.toBeInTheDocument();
	});
});
