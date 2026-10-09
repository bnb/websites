import type { Photo } from './types';

// The flyer layout: one featured photograph, then justified rows. Every
// photograph keeps its own aspect ratio, and once the gallery knows its width,
// justify() breaks the photographs into rows that each fill it exactly, so the
// rows regroup as the window is resized and none is ever left part-empty (see
// Gallery.svelte and PhotoFigure.svelte for the CSS). Every few photographs a
// landscape runs full width as a feature frame. Photos stay in order (newest
// first). Pure, so it renders identically on the server and is unit-tested.

/** How many photographs sit between full-width feature frames. */
export const FEATURE_EVERY = 6;

/** How many photographs must follow a feature frame, so the last rows have enough to fill the width. */
export const FEATURE_TAIL = 3;

export interface Tile {
	/** index into the full photos array (also the lightbox index) */
	index: number;
	/** a full-width frame between the justified rows */
	feature: boolean;
}

export interface FlyerLayout {
	/** index of the featured photograph, or -1 when there are none */
	featured: number;
	/** every photograph except the featured one, in order */
	tiles: Tile[];
}

export function isPortrait(photo: Pick<Photo, 'width' | 'height'>): boolean {
	return photo.height > photo.width;
}

/** Width over height, falling back to 3:2 for a record without usable dimensions. */
export function aspect(photo: Pick<Photo, 'width' | 'height'>): number {
	return photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 3 / 2;
}

/** The preferred photograph if present, else the newest landscape one, else the newest. */
export function pickFeatured(photos: readonly Photo[], preferredCid?: string): number {
	if (!photos.length) return -1;
	const preferred = preferredCid ? photos.findIndex((p) => p.cid === preferredCid) : -1;
	if (preferred >= 0) return preferred;
	const landscape = photos.findIndex((p) => !isPortrait(p));
	return Math.max(landscape, 0);
}

export function flyerLayout(photos: readonly Photo[], preferredCid?: string): FlyerLayout {
	const featured = pickFeatured(photos, preferredCid);
	const order = photos.map((_, i) => i).filter((i) => i !== featured);

	// after every FEATURE_EVERY photographs, the next landscape runs full width;
	// never one of the last few, so the grid closes on rows with enough to fill
	let since = 0;
	const tiles = order.map((index, n) => {
		const feature =
			since >= FEATURE_EVERY && !isPortrait(photos[index]) && n + FEATURE_TAIL < order.length;
		since = feature ? 0 : since + 1;
		return { index, feature };
	});

	return { featured, tiles };
}

/** A photograph's place in a justified row: its share of the row's width, and how many share the row. */
export interface RowFit {
	share: number;
	count: number;
}

/**
 * Breaks a run of photographs (given by aspect ratio) into rows that each fill
 * `width` exactly, keeping every row's height as close to `target` as it can.
 * Returns how many photographs go in each row.
 */
export function breakRows(
	aspects: readonly number[],
	width: number,
	target: number,
	gap: number
): number[] {
	// best[end]: the lowest cost of laying out the first `end` photographs, where
	// a row costs its squared log distance from the target height (so a row twice
	// as tall costs the same as one half as tall); from[end]: where its last row starts
	const best = [0];
	const from = [0];
	for (let end = 1; end <= aspects.length; end++) {
		best[end] = Infinity;
		let sum = 0;
		for (let start = end - 1; start >= 0; start--) {
			sum += aspects[start];
			const height = (width - (end - start - 1) * gap) / sum;
			const cost = best[start] + Math.log(height / target) ** 2;
			if (cost < best[end] || start === end - 1) {
				best[end] = cost;
				from[end] = start;
			}
			// rows only get shorter as more photographs join them
			if (height < target / 4) break;
		}
	}

	const counts: number[] = [];
	for (let end = aspects.length; end > 0; end = from[end]) counts.unshift(end - from[end]);
	return counts;
}

/**
 * Justifies the tiles at a given grid width: the photographs between feature
 * frames break into rows that each fill the width (see breakRows). One entry
 * per tile, null for a feature frame, which already runs full width.
 */
export function justify(
	tiles: readonly Tile[],
	photos: readonly Photo[],
	width: number,
	target: number,
	gap: number
): Array<RowFit | null> {
	const fits: Array<RowFit | null> = [];
	let run: number[] = [];
	const flush = () => {
		let start = 0;
		for (const count of breakRows(run, width, target, gap)) {
			const row = run.slice(start, start + count);
			const sum = row.reduce((total, ar) => total + ar, 0);
			for (const ar of row) fits.push({ share: ar / sum, count });
			start += count;
		}
		run = [];
	};

	for (const tile of tiles) {
		if (tile.feature) {
			flush();
			fits.push(null);
		} else {
			run.push(aspect(photos[tile.index]));
		}
	}
	flush();
	return fits;
}
