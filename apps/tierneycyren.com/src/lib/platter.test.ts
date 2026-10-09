import { describe, expect, it } from 'vitest';
import { SECONDS_PER_TURN, angleAround, scrub, turnBetween } from './platter';

describe('angleAround', () => {
	it('measures clockwise from three o’clock, as the screen draws it', () => {
		expect(angleAround(10, 0, 0, 0)).toBe(0);
		expect(angleAround(0, 10, 0, 0)).toBe(90);
		expect(angleAround(-10, 0, 0, 0)).toBe(180);
		expect(angleAround(0, -10, 0, 0)).toBe(-90);
	});
});

describe('turnBetween', () => {
	it('is the shortest way round, positive clockwise', () => {
		expect(turnBetween(0, 30)).toBe(30);
		expect(turnBetween(30, 0)).toBe(-30);
	});

	it('crosses the ±180° seam without jumping a whole turn', () => {
		expect(turnBetween(170, -170)).toBe(20);
		expect(turnBetween(-170, 170)).toBe(-20);
		expect(turnBetween(0, 180)).toBe(180);
		expect(turnBetween(0, -180)).toBe(180);
	});
});

describe('scrub', () => {
	it('moves a minute of the mix for each full turn', () => {
		expect(SECONDS_PER_TURN).toBe(60);
		expect(scrub(100, 360, 3600)).toBe(160);
		expect(scrub(100, -90, 3600)).toBe(85);
	});

	it('stays inside the mix', () => {
		expect(scrub(10, -360, 3600)).toBe(0);
		expect(scrub(3590, 360, 3600)).toBe(3600);
		// an unknown length only stops at the start
		expect(scrub(3590, 360, 0)).toBe(3650);
	});
});
