import { describe, expect, it } from 'vitest';
import { dominantColours } from './palette';

type Rgb = [number, number, number];

/** Raw RGB bytes: `n` pixels of each colour, in order. */
const pixels = (...runs: Array<[colour: Rgb, n: number]>) =>
	Uint8Array.from(
		runs.flatMap(([colour, n]) => Array.from<Rgb>({ length: n }).fill(colour).flat())
	);

const RED: Rgb = [255, 0, 0];
const BLUE: Rgb = [0, 0, 255];
const BLACK: Rgb = [0, 0, 0];
const ACID: Rgb = [215, 255, 58];

describe('dominantColours', () => {
	it('finds each colour in the frame with its share, dark to light', () => {
		expect(dominantColours(pixels([RED, 75], [BLUE, 25]), 3, 5)).toEqual([
			{ hex: '#0000ff', share: 0.25 },
			{ hex: '#ff0000', share: 0.75 }
		]);
	});

	it('keeps at most as many colours as it was asked for', () => {
		const swatches = dominantColours(pixels([BLACK, 40], [RED, 30], [BLUE, 20], [ACID, 10]), 3, 3);
		// the acid pixels left over join the colour nearest them, red, and pull it toward them
		expect(swatches).toEqual([
			{ hex: '#000000', share: 0.4 },
			{ hex: '#0000ff', share: 0.2 },
			{ hex: '#f5400f', share: 0.4 }
		]);
	});

	it('reads near-identical shades as one colour, at their average', () => {
		expect(dominantColours(pixels([[250, 0, 0], 50], [[254, 4, 4], 50]), 3, 5)).toEqual([
			{ hex: '#fc0202', share: 1 }
		]);
	});

	it('settles each colour on the middle of its cluster', () => {
		// two loose clusters around dark grey and acid green
		const [dark, light] = dominantColours(
			pixels([[10, 10, 10], 30], [[30, 30, 30], 30], [[200, 250, 50], 20], [[230, 255, 66], 20]),
			3,
			5
		);
		expect(dark).toEqual({ hex: '#141414', share: 0.6 });
		expect(light).toEqual({ hex: '#d7fd3a', share: 0.4 });
	});

	it('skips any channels past red, green and blue', () => {
		const rgba = Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 128, 0, 0, 255, 255, 0, 0, 255, 9]);
		expect(dominantColours(rgba, 4, 5)).toEqual([
			{ hex: '#0000ff', share: 0.5 },
			{ hex: '#ff0000', share: 0.5 }
		]);
	});

	it('has nothing to say about an empty image', () => {
		expect(dominantColours(new Uint8Array(), 3, 5)).toEqual([]);
	});
});
