import type { ComponentProps } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { Tile } from '../layout';
import type { Photo } from '../types';
import Gallery from './Gallery.svelte';
// registers --row-target, which the gallery reads in pixels, and sets the gutters
import '../../app.css';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const EMPTY = /^No photographs found in this repository yet\./;
const OUTAGE = /^Couldn't reach the AT\sProtocol right now\./;

// a tiny in-page image stands in for the CDN, so nothing touches the network
const { stub } = vi.hoisted(() => ({
	stub: (label: string) =>
		`data:image/svg+xml,${encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><title>${label}</title></svg>`
		)}`
}));
vi.mock('../atproto', async (importOriginal) => ({
	...(await importOriginal<typeof import('../atproto')>()),
	thumbUrl: (cid: string) => stub(`thumb ${cid}`),
	fullUrl: (cid: string) => stub(`full ${cid}`),
	blobUrl: (_pds: string, cid: string) => stub(`blob ${cid}`)
}));

function photo(n: number, shape: 'landscape' | 'portrait' = 'landscape'): Photo {
	const [width, height] = shape === 'landscape' ? [3000, 2000] : [2000, 3000];
	return {
		uri: `at://photo/${n}`,
		cid: `cid-${n}`,
		width,
		height,
		alt: '',
		date: '2026-07-09T14:00:50Z',
		posted: '2026-09-17T00:00:00Z',
		place: `Place ${n}`,
		camera: '',
		lens: '',
		focal: '',
		aperture: '',
		shutter: '',
		iso: '',
		ev: null
	};
}

// photograph 0 is featured above the gallery; the rest are tiles, one of them a
// full-width feature frame between the justified rows
const photos = [
	photo(0),
	photo(1),
	photo(2, 'portrait'),
	photo(3, 'portrait'),
	photo(4),
	photo(5),
	photo(6),
	photo(7, 'portrait'),
	photo(8),
	photo(9)
];
const tiles: Tile[] = photos.slice(1).map((_, i) => ({ index: i + 1, feature: i + 1 === 5 }));

async function show(
	props: Partial<ComponentProps<typeof Gallery>> = {},
	baseElement?: HTMLElement
) {
	const onselect = vi.fn();
	const view = await render(
		Gallery,
		{ photos, tiles, pds: 'https://pds.test', onselect, ...props },
		{ baseElement }
	);
	return { ...view, onselect };
}

interface Fitted {
	index: number;
	feature: boolean;
	share: number;
	count: number;
}

/** Every figure in the grid, with the row fit the gallery gave it. */
function figures(container: HTMLElement): Fitted[] {
	return Array.from(container.querySelectorAll<HTMLElement>('figure'), (figure) => ({
		index: Number(figure.dataset.index),
		feature: figure.classList.contains('feature'),
		share: Number(figure.style.getPropertyValue('--share')),
		count: Number(figure.style.getPropertyValue('--count'))
	}));
}

/** Groups the justified figures into their rows, checking each row fills the width. */
function rows(container: HTMLElement): number[][] {
	const out: number[][] = [];
	const list = figures(container).filter((figure) => !figure.feature);
	for (let i = 0; i < list.length;) {
		const row = list.slice(i, i + list[i].count);
		expect(row).toHaveLength(list[i].count);
		for (const figure of row) expect(figure.count).toBe(row.length);
		expect(row.reduce((sum, figure) => sum + figure.share, 0)).toBeCloseTo(1, 6);
		out.push(row.map((figure) => figure.index));
		i += row.length;
	}
	return out;
}

const isFitted = (container: HTMLElement) =>
	[...container.querySelectorAll('figure:not(.feature)')].every((figure) =>
		figure.classList.contains('fitted')
	);

describe('Gallery (component)', () => {
	it('heads the work with a count of photographs and their date range', async () => {
		await show({ range: 'May – Aug 2026' });

		await expect.element(page.getByRole('region', { name: 'The work' })).toBeInTheDocument();
		await expect.element(page.getByRole('heading', { level: 2, name: 'The work' })).toBeVisible();
		await expect.element(page.getByText('10 photographs · May – Aug 2026')).toBeVisible();
	});

	it('says "photograph" for one, and leaves out an empty range', async () => {
		const { container } = await show({ photos: [photo(0)], tiles: [] });

		expect(container.querySelector('.head p')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'1 photograph'
		);
		// the only photograph is featured above, so there's no grid and nothing to apologise for
		expect(container.querySelector('.grid')).toBeNull();
		expect(container.querySelector('.state')).toBeNull();
	});

	it('explains an empty repository, with a link to the records', async () => {
		const { container } = await show({ photos: [], tiles: [] });

		await expect.element(page.getByText(EMPTY)).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'grain.social' }))
			.toHaveAttribute('href', 'https://grain.social/profile/bnb.im');
		expect(container.querySelector('.head p')).toBeNull();
	});

	it('explains an outage', async () => {
		const { container } = await show({ photos: [], tiles: [], loadError: true });

		await expect.element(page.getByText(OUTAGE)).toBeVisible();
		expect(container.textContent).not.toContain('No photographs found');
	});

	it('opens the lightbox at the photograph’s index in the full set', async () => {
		const { onselect } = await show();

		await page.getByRole('button', { name: 'Open photograph 04, Place 3' }).click();
		expect(onselect).toHaveBeenCalledWith(3);
	});

	it('renders a tile for every photograph but the featured one, in order', async () => {
		const { container } = await show();

		const shown = figures(container);
		expect(shown.map((figure) => figure.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
		expect(shown.filter((figure) => figure.feature).map((figure) => figure.index)).toEqual([5]);
	});

	it('justifies the rows once it has measured its width', async () => {
		const { container } = await show();

		await vi.waitFor(() => expect(isFitted(container)).toBe(true));
		const narrow = rows(container);
		// every photograph is in exactly one row, in order, and the feature frame isn't fitted
		expect(narrow.flat()).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
		const feature = container.querySelector<HTMLElement>('figure.feature')!;
		expect(feature.classList.contains('fitted')).toBe(false);
		expect(feature.style.getPropertyValue('--share')).toBe('');
		// the rows break either side of the feature frame
		expect(narrow.some((row) => row.includes(4) && row.includes(6))).toBe(false);
	});

	it('regroups the rows as it resizes', async () => {
		const { container } = await show();
		await vi.waitFor(() => expect(isFitted(container)).toBe(true));
		const before = Math.max(...rows(container).map((row) => row.length));

		container.style.width = '2400px';
		await vi.waitFor(() =>
			expect(Math.max(...rows(container).map((row) => row.length))).toBeGreaterThan(before)
		);
		expect(rows(container).flat()).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
	});

	it('leaves the rows to flexbox until it has a width to measure', async () => {
		const hidden = document.createElement('div');
		hidden.style.display = 'none';
		document.body.append(hidden);

		try {
			const { container } = await show({}, hidden);
			await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));
			expect(container.querySelectorAll('figure.fitted')).toHaveLength(0);

			hidden.style.display = '';
			await vi.waitFor(() => expect(isFitted(container)).toBe(true));
		} finally {
			hidden.remove();
		}
	});
});
