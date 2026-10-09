import { describe, expect, it } from 'vitest';
import type { Photo } from './types';
import {
	FEATURE_EVERY,
	FEATURE_TAIL,
	aspect,
	breakRows,
	flyerLayout,
	isPortrait,
	justify,
	pickFeatured
} from './layout';

const L = { width: 2000, height: 1333 };
const P = { width: 1333, height: 2000 };

function photos(shapes: Array<typeof L>): Photo[] {
	return shapes.map((shape, i) => ({
		uri: `uri-${i}`,
		cid: `cid-${i}`,
		...shape,
		alt: '',
		date: '',
		posted: '',
		place: '',
		camera: '',
		lens: '',
		focal: '',
		aperture: '',
		shutter: '',
		iso: '',
		ev: null
	}));
}

const landscapes = (count: number) => Array.from({ length: count }, () => ({ ...L }));

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** The height of each row that breakRows() chose. */
function rowHeights(aspects: number[], counts: number[], width: number, gap: number): number[] {
	let start = 0;
	return counts.map((count) => {
		const row = aspects.slice(start, (start += count));
		return (width - (count - 1) * gap) / sum(row);
	});
}

describe('pickFeatured', () => {
	it('prefers the configured photograph when present', () => {
		expect(pickFeatured(photos([L, L, L]), 'cid-2')).toBe(2);
	});

	it('falls back to the newest landscape photograph, then the newest of all', () => {
		expect(pickFeatured(photos([P, L, L]), 'gone')).toBe(1);
		expect(pickFeatured(photos([P, P]))).toBe(0);
		expect(pickFeatured([])).toBe(-1);
	});
});

describe('aspect', () => {
	it('is width over height, with a 3:2 fallback for missing dimensions', () => {
		expect(aspect(L)).toBeCloseTo(1.5, 2);
		expect(aspect(P)).toBeCloseTo(0.667, 2);
		expect(aspect({ width: 0, height: 0 })).toBe(1.5);
		expect(isPortrait(P)).toBe(true);
	});
});

describe('flyerLayout', () => {
	it('places every photograph exactly once, in order, around the featured one', () => {
		const set = photos(Array.from({ length: 23 }, (_, i) => (i % 5 === 3 ? P : L)));
		const { featured, tiles } = flyerLayout(set, 'cid-7');

		expect(featured).toBe(7);
		expect(tiles.map((tile) => tile.index)).toEqual(set.map((_, i) => i).filter((i) => i !== 7));
	});

	it(`runs a landscape full width after every ${FEATURE_EVERY} photographs`, () => {
		const { tiles } = flyerLayout(photos(landscapes(20)));
		const features = tiles.flatMap((tile, n) => (tile.feature ? [n] : []));

		expect(features).toEqual([FEATURE_EVERY, FEATURE_EVERY * 2 + 1]);
	});

	it('waits for the next landscape rather than running a portrait full width', () => {
		// featured = 0; photographs 7 and 8 are portraits, so 9 becomes the feature
		const shapes = [L, ...landscapes(6), P, P, ...landscapes(1 + FEATURE_TAIL)];
		const { tiles } = flyerLayout(photos(shapes));

		expect(tiles.filter((tile) => tile.feature).map((tile) => tile.index)).toEqual([9]);
		const portraits = Array.from({ length: 12 }, () => ({ ...P }));
		expect(flyerLayout(photos([L, ...portraits])).tiles.some((t) => t.feature)).toBe(false);
	});

	it(`leaves at least ${FEATURE_TAIL} photographs after a feature, so the last rows can fill`, () => {
		const short = flyerLayout(photos(landscapes(1 + FEATURE_EVERY + FEATURE_TAIL)));
		expect(short.tiles).toHaveLength(FEATURE_EVERY + FEATURE_TAIL);
		expect(short.tiles.some((tile) => tile.feature)).toBe(false);

		const enough = flyerLayout(photos(landscapes(2 + FEATURE_EVERY + FEATURE_TAIL)));
		expect(enough.tiles.findIndex((tile) => tile.feature)).toBe(FEATURE_EVERY);
	});

	it('is empty for an empty repository', () => {
		expect(flyerLayout([])).toEqual({ featured: -1, tiles: [] });
	});
});

describe('breakRows', () => {
	it('balances the rows rather than leaving a short one at the end', () => {
		// greedily, three of these fit a row at this width and the fourth sits alone
		expect(breakRows([1.5, 1.5, 1.5, 1.5], 1200, 300, 16)).toEqual([2, 2]);
		expect(breakRows([1.5, 1.5, 0.667, 1.5], 1500, 350, 16)).toEqual([4]);
	});

	it('keeps every photograph, in order, at any width', () => {
		const aspects = Array.from({ length: 31 }, (_, i) => (i % 4 === 2 ? 0.667 : 1.5));
		for (const width of [320, 600, 1024, 1500, 2500]) {
			const counts = breakRows(aspects, width, 300, 16);
			expect(sum(counts)).toBe(aspects.length);
			expect(counts.every((count) => count >= 1)).toBe(true);
		}
	});

	it('keeps rows near the target height', () => {
		const aspects = Array.from({ length: 24 }, (_, i) => (i % 3 === 1 ? 0.667 : 1.5));
		const counts = breakRows(aspects, 1500, 350, 16);
		for (const height of rowHeights(aspects, counts, 1500, 16)) {
			expect(height).toBeGreaterThan(350 / 1.6);
			expect(height).toBeLessThan(350 * 1.6);
		}
	});

	it('puts one photograph to a row when only one fits', () => {
		expect(breakRows([1.5, 1.5, 1.5], 340, 280, 10)).toEqual([1, 1, 1]);
		expect(breakRows([], 1200, 300, 16)).toEqual([]);
	});
});

describe('justify', () => {
	it('splits each row between its photographs by aspect ratio, around the features', () => {
		const set = photos([L, ...landscapes(6), L, P, L, L]);
		const { tiles } = flyerLayout(set);
		const fits = justify(tiles, set, 1500, 350, 16);

		expect(fits).toHaveLength(tiles.length);
		expect(fits[FEATURE_EVERY]).toBeNull();
		expect(tiles[FEATURE_EVERY].feature).toBe(true);

		// within each row the shares add up to the whole width
		let n = 0;
		while (n < fits.length) {
			const fit = fits[n];
			if (!fit) {
				n++;
				continue;
			}
			const row = fits.slice(n, n + fit.count);
			expect(row.every((other) => other?.count === fit.count)).toBe(true);
			expect(sum(row.map((other) => other?.share ?? 0))).toBeCloseTo(1, 10);
			n += fit.count;
		}

		// a portrait takes a smaller share of its row than a landscape
		const portrait = fits[tiles.findIndex((tile) => tile.index === 8)];
		const landscape = fits[tiles.findIndex((tile) => tile.index === 9)];
		expect(portrait?.count).toBe(landscape?.count);
		expect(portrait!.share).toBeLessThan(landscape!.share);
	});
});
