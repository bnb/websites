import type { Swatch } from './types';

// A photograph's dominant colours, from its raw pixels. Seeds come from the
// most crowded cells of a coarse colour grid (skipping ones too close to a seed
// already taken), then a few rounds of k-means settle each colour on the middle
// of its cluster. Deterministic, and pure, so it's unit-tested without images.

type Rgb = [number, number, number];

/** Seeds closer than this (squared RGB distance) would show as one colour twice. */
const MIN_SEED_DISTANCE = 48 ** 2;
const ROUNDS = 4;

const distance = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Relative luminance, near enough: green counts most, blue least. */
const luma = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const hex = (rgb: Rgb) =>
	`#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;

function nearest(pixel: Rgb, centres: Rgb[]): number {
	let best = 0;
	for (let c = 1; c < centres.length; c++) {
		if (distance(pixel, centres[c]) < distance(pixel, centres[best])) best = c;
	}
	return best;
}

/** The mean colour of each of the most crowded cells, eight levels per channel. */
function seeds(pixels: Rgb[], count: number): Rgb[] {
	const cells = new Map<number, { sum: Rgb; n: number }>();
	for (const [r, g, b] of pixels) {
		const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
		const cell = cells.get(key) ?? { sum: [0, 0, 0], n: 0 };
		cell.sum[0] += r;
		cell.sum[1] += g;
		cell.sum[2] += b;
		cell.n++;
		cells.set(key, cell);
	}
	const chosen: Rgb[] = [];
	for (const { sum, n } of [...cells.values()].toSorted((a, b) => b.n - a.n)) {
		const mean: Rgb = [sum[0] / n, sum[1] / n, sum[2] / n];
		if (chosen.every((seed) => distance(seed, mean) >= MIN_SEED_DISTANCE)) chosen.push(mean);
		if (chosen.length === count) break;
	}
	return chosen;
}

/** One round of k-means: each centre moves to the mean of the pixels nearest it. */
function settle(pixels: Rgb[], centres: Rgb[]): Rgb[] {
	const clusters = centres.map(() => ({ sum: [0, 0, 0] as Rgb, n: 0 }));
	for (const pixel of pixels) {
		const cluster = clusters[nearest(pixel, centres)];
		for (let channel = 0; channel < 3; channel++) cluster.sum[channel] += pixel[channel];
		cluster.n++;
	}
	return clusters.map(({ sum, n }, c): Rgb =>
		n ? [sum[0] / n, sum[1] / n, sum[2] / n] : centres[c]
	);
}

/**
 * Up to `count` dominant colours of an image's raw pixels (`channels` bytes
 * each; any past the third, like alpha, are ignored), each with its share of
 * the pixels. They run dark to light, so a strip of them reads as a tonal ramp.
 */
export function dominantColours(data: Uint8Array, channels: number, count: number): Swatch[] {
	const pixels: Rgb[] = [];
	for (let i = 0; i + 2 < data.length; i += channels)
		pixels.push([data[i], data[i + 1], data[i + 2]]);

	let centres = seeds(pixels, count);
	for (let round = 0; round < ROUNDS; round++) centres = settle(pixels, centres);

	const sizes = centres.map(() => 0);
	for (const pixel of pixels) sizes[nearest(pixel, centres)]++;
	return centres
		.map((centre, c) => ({ centre, share: sizes[c] / pixels.length }))
		.filter(({ share }) => share > 0)
		.toSorted((a, b) => luma(a.centre) - luma(b.centre))
		.map(({ centre, share }) => ({ hex: hex(centre), share }));
}
