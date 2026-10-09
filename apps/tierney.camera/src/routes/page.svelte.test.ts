import type { ComponentProps } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import type { Photo } from '$lib/types';
import Page from './+page.svelte';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const OUTAGE = /^Couldn't reach the AT\sProtocol right now\./;

// a tiny in-page image stands in for the CDN, so nothing touches the network
const { stub } = vi.hoisted(() => ({
	stub: (label: string) =>
		`data:image/svg+xml,${encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><title>${label}</title></svg>`
		)}`
}));
vi.mock('$lib/atproto', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/atproto')>()),
	thumbUrl: (cid: string) => stub(`thumb ${cid}`),
	fullUrl: (cid: string) => stub(`full ${cid}`),
	blobUrl: (_pds: string, cid: string) => stub(`blob ${cid}`)
}));

type PageData = ComponentProps<typeof Page>['data'];

function photo(n: number, extra: Partial<Photo> = {}): Photo {
	return {
		uri: `at://photo/${n}`,
		cid: `cid-${n}`,
		width: 3000,
		height: 2000,
		alt: '',
		date: '2026-07-09T14:00:50Z',
		posted: `2026-09-${String(20 - n).padStart(2, '0')}T00:00:00Z`,
		place: `Place ${n}, New York`,
		camera: 'Sony α7R IV',
		lens: 'FE 50mm ƒ/1.4 GM',
		focal: '50mm',
		aperture: 'ƒ/1.4',
		shutter: '1/80',
		iso: `ISO ${n * 1000}`,
		ev: null,
		...extra
	};
}

function data(extra: Partial<PageData> = {}): PageData {
	return {
		profile: { displayName: 'tierney cyren', description: 'photographer.\nnyc.', avatarCid: null },
		// the first is a portrait, so the newest landscape is featured
		photos: [photo(1, { width: 2000, height: 3000 }), photo(2), photo(3)],
		pds: 'https://pds.test',
		palettes: {},
		likes: {},
		latest: {},
		loadError: false,
		...extra
	};
}

/** Every AT Tag in the head, as [property, AT URI] pairs. */
const atTagsInHead = () =>
	Array.from(document.head.querySelectorAll('meta[name^="at:"]'), (meta) => [
		meta.getAttribute('name'),
		meta.getAttribute('content')
	]);

const counter = (text: string) => page.getByRole('dialog').getByText(text, { exact: true });

describe('home page', () => {
	it('lays out the flyer: masthead, featured photograph, ticker, gallery and footer', async () => {
		const { container } = await render(Page, { data: data() });

		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('tierney cyren');
		await expect
			.element(page.getByRole('button', { name: 'Open photograph 02, Place 2, New York' }).first())
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('checkbox', { name: 'Pause the ticker' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('3 photographs · Jul 2026')).toBeVisible();
		// every photograph but the featured one is in the gallery
		const tiles = [...container.querySelectorAll<HTMLElement>('#work figure')];
		expect(tiles.map((figure) => figure.dataset.index)).toEqual(['0', '2']);
		// the footer lists the kit across the whole set
		const footer = page.getByRole('contentinfo').element();
		expect(footer.textContent).toContain('Sony α7R IVFE 50mm ƒ/1.4 GM');
		expect(document.title).toBe('tierney cyren · photography');
	});

	it('maps the page to its grain.social records with AT Tags', async () => {
		await render(Page, { data: data() });
		expect(atTagsInHead()).toEqual([
			['at:alternate', 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/social.grain.actor.profile/self'],
			['at:alternate', 'at://photo/1'],
			['at:alternate', 'at://photo/2'],
			['at:alternate', 'at://photo/3'],
			['at:author', 'at://did:plc:uashgn65n5z7aqwk5cbuba5c']
		]);
	});

	it('leaves the profile out of the AT Tags when there is none', async () => {
		await render(Page, { data: data({ profile: null, photos: [photo(1)] }) });
		expect(atTagsInHead()).toEqual([
			['at:alternate', 'at://photo/1'],
			['at:author', 'at://did:plc:uashgn65n5z7aqwk5cbuba5c']
		]);
	});

	it('opens a photograph in the lightbox, pages round the set and closes again', async () => {
		await render(Page, { data: data() });

		await page.getByRole('button', { name: 'Open photograph 01, Place 1, New York' }).click();
		await expect.element(counter('01 / 03')).toBeVisible();

		await userEvent.keyboard('{ArrowLeft}');
		await expect.element(counter('03 / 03')).toBeVisible();
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(counter('01 / 03')).toBeVisible();
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(counter('02 / 03')).toBeVisible();

		await page.getByRole('button', { name: 'Close' }).click();
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('opens the featured photograph from the feature frame', async () => {
		const { container } = await render(Page, { data: data() });

		const feature = container.querySelector<HTMLButtonElement>('.feature .frame')!;
		await page.elementLocator(feature).click();
		await expect.element(counter('02 / 03')).toBeVisible();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('explains an outage, with no feature or ticker', async () => {
		const { container } = await render(Page, {
			data: data({ profile: null, photos: [], loadError: true })
		});

		await expect.element(page.getByText(OUTAGE)).toBeVisible();
		expect(container.querySelector('.feature')).toBeNull();
		expect(container.querySelector('.ticker')).toBeNull();
		expect(document.title).toBe('tierney cyren · photography');
		expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
			'Photography, read live from the AT Protocol.'
		);
	});
});
