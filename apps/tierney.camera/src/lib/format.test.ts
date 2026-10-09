import { describe, expect, it } from 'vitest';
import type { Photo } from './types';
import {
	exposure,
	formatEv,
	frameNumber,
	kit,
	monthRange,
	nameLines,
	peakIso,
	personName,
	placeHead,
	shortPlace,
	stampDate,
	tickerItems
} from './format';

function photo(extra: Partial<Photo> = {}): Photo {
	return {
		uri: 'at://photo',
		cid: 'cid',
		width: 2000,
		height: 1333,
		alt: '',
		date: '2026-07-09T14:00:50Z',
		posted: '2026-09-17T00:00:00Z',
		place: 'Bushwick, New York',
		camera: 'Sony α7R IV',
		lens: 'FE 50mm ƒ/1.4 GM',
		focal: '50mm',
		aperture: 'ƒ/2.2',
		shutter: '1/80',
		iso: 'ISO 12800',
		ev: 1.6,
		...extra
	};
}

describe('caption formatting', () => {
	it('numbers frames from 01', () => {
		expect(frameNumber(0)).toBe('01');
		expect(frameNumber(11)).toBe('12');
		expect(frameNumber(99)).toBe('100');
	});

	it('abbreviates US states and leaves other places alone', () => {
		expect(shortPlace('Bushwick, New York')).toBe('Bushwick, NY');
		expect(shortPlace('Shoreditch, London')).toBe('Shoreditch, London');
		expect(shortPlace('New York')).toBe('New York');
		expect(shortPlace('')).toBe('');
		expect(placeHead('Manhattan, New York')).toBe('Manhattan');
	});

	it('stamps capture dates as MM.DD.YY in UTC', () => {
		expect(stampDate('2026-07-09T14:00:50Z')).toBe('07.09.26');
		expect(stampDate('2026-12-31T23:59:59Z')).toBe('12.31.26');
		expect(stampDate('nonsense')).toBe('');
		expect(stampDate(undefined)).toBe('');
	});

	it('builds full and compact exposure lines, skipping missing values', () => {
		expect(exposure(photo())).toBe('50mm ƒ/2.2 1/80 ISO 12800');
		expect(exposure(photo(), true)).toBe('ƒ/2.2 ISO 12800');
		expect(exposure(photo({ focal: '', shutter: '' }))).toBe('ƒ/2.2 ISO 12800');
	});
});

describe('collection facts', () => {
	const set = [
		photo({ date: '2026-05-02T15:50:31Z', iso: 'ISO 4000', place: '' }),
		photo({ date: '2026-08-20T16:17:13Z', iso: 'ISO 2000' }),
		photo({ place: 'Manhattan, New York', iso: 'ISO 12800' })
	];

	it('finds the highest ISO', () => {
		expect(peakIso(set)).toBe('ISO 12800');
		expect(peakIso([photo({ iso: '' })])).toBe('');
	});

	it('spans capture months, collapsing a shared month or year', () => {
		expect(monthRange(set)).toBe('May – Aug 2026');
		expect(monthRange([photo()])).toBe('Jul 2026');
		expect(monthRange([photo({ date: '2025-11-01T00:00:00Z' }), photo()])).toBe(
			'Nov 2025 – Jul 2026'
		);
		expect(monthRange([photo({ date: '' })])).toBe('');
	});

	it('lists kit and ticker items without duplicates', () => {
		expect(kit(set)).toEqual(['Sony α7R IV', 'FE 50mm ƒ/1.4 GM']);
		expect(tickerItems(set)).toEqual([
			'Bushwick',
			'Manhattan',
			'Sony α7R IV',
			'FE 50mm ƒ/1.4 GM',
			'ISO 12800'
		]);
		expect(tickerItems([])).toEqual([]);
	});
});

describe('formatEv', () => {
	it('reads to one decimal', () => {
		expect(formatEv(1.556)).toBe('EV 1.6');
		expect(formatEv(14)).toBe('EV 14.0');
		expect(formatEv(-1.25)).toBe('EV -1.2');
	});

	it('never reads "-0.0"', () => {
		expect(formatEv(-0.04)).toBe('EV 0.0');
	});
});

describe('names', () => {
	it('uses the profile name, else "tierney cyren"', () => {
		expect(personName({ displayName: '  Tierney Cyren ', description: '', avatarCid: null })).toBe(
			'Tierney Cyren'
		);
		expect(personName({ displayName: ' ', description: '', avatarCid: null })).toBe(
			'tierney cyren'
		);
		expect(personName(null)).toBe('tierney cyren');
	});

	it('puts the last word on a line of its own', () => {
		expect(nameLines('tierney cyren')).toEqual(['tierney', 'cyren']);
		expect(nameLines('mary  jo   smith')).toEqual(['mary jo', 'smith']);
		expect(nameLines('cyren')).toEqual(['cyren']);
	});
});
