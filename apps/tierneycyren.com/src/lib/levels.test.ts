import { describe, expect, it } from 'vitest';
import { MIN_FLASH_GAP_MS, bands, canFlash, energy, follow, isHit, settle } from './levels';

/** 64 bins of 25 Hz each, with `levels` set at the given bins */
const spectrum = (levels: Record<number, number> = {}) => {
	const bins = new Uint8Array(64);
	for (const [bin, level] of Object.entries(levels)) bins[Number(bin)] = level;
	return bins;
};

describe('energy', () => {
	it('is the mean of the bass bins, 0–1', () => {
		// 40–160 Hz at 25 Hz a bin is bins 1 to 7
		const bins = spectrum({ 1: 255, 2: 255, 3: 255, 4: 255, 5: 255, 6: 255, 7: 255, 20: 255 });
		expect(energy(bins, 25)).toBe(1);
		expect(energy(spectrum({ 20: 255 }), 25)).toBe(0);
		expect(energy(spectrum({ 1: 255 }), 25)).toBeCloseTo(1 / 7);
	});

	it('skips the DC bin and stays inside the array', () => {
		expect(energy(spectrum({ 0: 255 }), 25)).toBe(0);
		// 1–5 kHz runs past the last bin; reading beyond it would give NaN
		expect(energy(new Uint8Array(64).fill(255), 25, 1000, 5000)).toBe(1);
	});
});

describe('bands', () => {
	it('gives one level per band, low to high, each its loudest bin', () => {
		const levels = bands(spectrum({ 2: 51, 60: 255 }), 25, 8, 50, 1600);
		expect(levels).toHaveLength(8);
		expect(levels[0]).toBeCloseTo(0.2);
		expect(levels.at(-1)).toBe(1);
		expect(levels.slice(1, -1).every((level) => level === 0)).toBe(true);
	});

	it('spaces the bands logarithmically, so the lows get as many as the highs', () => {
		// 50 Hz to 12.8 kHz in 8 bands doubles each band: 50, 100, 200 … 6400 Hz
		const bins = new Uint8Array(1024);
		bins[Math.floor(400 / 12.5)] = 255;
		expect(bands(bins, 12.5, 8, 50, 12_800).indexOf(1)).toBe(3);
	});
});

describe('smoothing', () => {
	it('rises quickly with a hit and falls away slowly', () => {
		const up = follow(0, 1);
		const down = 1 - follow(1, 0);
		expect(up).toBeGreaterThan(0.5);
		expect(down).toBeLessThan(0.2);
	});

	it('catches the running average up over its window', () => {
		expect(settle(0, 1, 1500, 3000)).toBe(0.5);
		expect(settle(0, 1, 6000, 3000)).toBe(1);
		expect(settle(0.4, 0.4, 16)).toBe(0.4);
	});
});

describe('isHit', () => {
	it('is a loud bass well above what came before: a drop', () => {
		expect(isHit(0.9, 0.3)).toBe(true);
		// loud, but the track has been this loud all along
		expect(isHit(0.9, 0.8)).toBe(false);
		// a jump, but too quiet to count
		expect(isHit(0.45, 0.1)).toBe(false);
	});
});

describe('canFlash', () => {
	it('flashes the first time, then waits out the minimum gap', () => {
		expect(canFlash(undefined, 0)).toBe(true);
		expect(canFlash(1000, 1000 + MIN_FLASH_GAP_MS - 1)).toBe(false);
		expect(canFlash(1000, 1000 + MIN_FLASH_GAP_MS)).toBe(true);
	});

	it('never lets more than three flashes into any second (WCAG 2.3.1)', () => {
		// a hit on every frame at 60 fps for ten seconds, the worst case
		const flashes: number[] = [];
		for (let now = 0; now < 10_000; now += 1000 / 60) {
			if (canFlash(flashes.at(-1), now)) flashes.push(now);
		}
		const busiest = Math.max(
			...flashes.map((t) => flashes.filter((u) => u >= t && u < t + 1000).length)
		);
		expect(busiest).toBeLessThanOrEqual(3);
		expect(flashes.length).toBeGreaterThan(20);
	});
});
