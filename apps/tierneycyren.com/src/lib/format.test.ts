import { describe, expect, it } from 'vitest';
import { MIXES } from './fixtures';
import {
	isoDuration,
	lengthScale,
	marqueeItems,
	mixNumber,
	mixSummary,
	postedDate,
	runningTime,
	totalTime
} from './format';

describe('format', () => {
	it('writes running times', () => {
		expect(runningTime(1335)).toBe('22:15');
		expect(runningTime(3430)).toBe('57:10');
		expect(runningTime(3725)).toBe('1:02:05');
		expect(runningTime(59)).toBe('0:59');
		expect(runningTime(0)).toBe('');
		expect(runningTime(-4)).toBe('');
	});

	it('writes ISO 8601 durations', () => {
		expect(isoDuration(1335)).toBe('PT22M15S');
		expect(isoDuration(3725)).toBe('PT1H2M5S');
		expect(isoDuration(3600)).toBe('PT1H0S');
		expect(isoDuration(-1)).toBe('PT0S');
	});

	it('dates in UTC', () => {
		expect(postedDate('2026-08-25T23:53:12.562753Z')).toBe('Aug 25, 2026');
		expect(postedDate('nope')).toBe('');
		expect(postedDate()).toBe('');
	});

	it('numbers mixes up from the oldest', () => {
		expect(mixNumber(0, 2)).toBe('02');
		expect(mixNumber(1, 2)).toBe('01');
		expect(mixNumber(0, 120)).toBe('120');
	});

	it('totals the running time', () => {
		expect(totalTime(MIXES)).toBe('1 hr 19 min');
		expect(totalTime(MIXES.slice(0, 1))).toBe('22 min');
		expect(totalTime([])).toBe('');
	});

	it('sums up the mixes: how many, and how long', () => {
		expect(mixSummary(MIXES)).toBe('2 mixes · 1 hr 19 min');
		expect(mixSummary(MIXES.slice(1))).toBe('1 mix · 57 min');
		expect(mixSummary([{ ...MIXES[0], duration: 0 }])).toBe('1 mix');
		expect(mixSummary([])).toBe('');
	});

	it('draws every length to the scale the longest mix sets', () => {
		expect(lengthScale(1335, 3430)).toBeCloseTo(0.389);
		expect(lengthScale(3430, 3430)).toBe(1);
		expect(lengthScale(0, 3430)).toBe(0);
		expect(lengthScale(1335, 0)).toBe(0);
	});

	it('fills the marquee with the bio, then the mixes', () => {
		expect(marqueeItems('girl rave dj in bushwick', MIXES)).toEqual([
			'girl rave dj in bushwick',
			"one shot: I promise it's techno",
			'tierney cyren @ tachycardia 028'
		]);
		expect(marqueeItems('', [])).toEqual([]);
	});
});
