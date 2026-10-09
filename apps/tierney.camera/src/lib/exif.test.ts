import { describe, expect, it } from 'vitest';
import {
	aperture,
	cameraName,
	exposureValue,
	focalLength,
	formatDate,
	iso,
	lensName,
	shutter
} from './exif';

describe('exif decoding (grain stores rationals ×1e6)', () => {
	it('formats sub-second shutter speeds as reciprocals', () => {
		expect(shutter(12500)).toBe('1/80');
		expect(shutter(10000)).toBe('1/100');
		expect(shutter(33333)).toBe('1/30');
		expect(shutter(4000)).toBe('1/250');
	});

	it('formats long exposures in seconds', () => {
		expect(shutter(1_000_000)).toBe('1"');
		expect(shutter(2_500_000)).toBe('2.5"');
	});

	it('is defensive about missing / zero shutter', () => {
		expect(shutter()).toBe('');
		expect(shutter(0)).toBe('');
	});

	it('formats aperture, dropping trailing zeros', () => {
		expect(aperture(1_400_000)).toBe('ƒ/1.4');
		expect(aperture(2_200_000)).toBe('ƒ/2.2');
		expect(aperture(4_000_000)).toBe('ƒ/4');
	});

	it('formats ISO and focal length', () => {
		expect(iso(12_800_000_000)).toBe('ISO 12800');
		expect(iso(2_000_000_000)).toBe('ISO 2000');
		expect(focalLength(50_000_000)).toBe('50mm');
		expect(focalLength(75_000_000)).toBe('75mm');
	});

	it('prettifies Sony body and lens names', () => {
		expect(cameraName('SONY', 'ILCE-7RM4')).toBe('Sony α7R IV');
		expect(cameraName('SONY', 'ILCE-9999X')).toBe('Sony ILCE-9999X');
		expect(cameraName('SONY')).toBe('Sony');
		expect(cameraName()).toBe('');
		expect(lensName('FE 50mm F1.4 GM')).toBe('FE 50mm ƒ/1.4 GM');
	});

	it('measures scene brightness as EV at ISO 100', () => {
		// ƒ/1.4, 1/30 s, ISO 2000: log2(1.96 × 30) − log2(20)
		expect(exposureValue(1_400_000, 33_333, 2_000_000_000)).toBeCloseTo(1.56, 2);
		// ƒ/2.2, 1/80 s, ISO 12800
		expect(exposureValue(2_200_000, 12_500, 12_800_000_000)).toBeCloseTo(1.6, 1);
		// ƒ/16, 1/100 s, ISO 100: bright sun
		expect(exposureValue(16_000_000, 10_000, 100_000_000)).toBeCloseTo(14.64, 2);
		// ƒ/1.4, 4 s, ISO 6400: darker than the meter's scale goes
		expect(exposureValue(1_400_000, 4_000_000, 6_400_000_000)).toBeCloseTo(-7.03, 2);
	});

	it('has no exposure value without aperture, shutter and ISO', () => {
		expect(exposureValue(undefined, 12_500, 100_000_000)).toBeNull();
		expect(exposureValue(1_400_000, 0, 100_000_000)).toBeNull();
		expect(exposureValue(1_400_000, 12_500)).toBeNull();
	});

	it('formats capture dates in UTC', () => {
		expect(formatDate('2026-07-09T14:00:50Z')).toBe('Jul 9, 2026');
		expect(formatDate('2026-08-20T16:17:13Z')).toBe('Aug 20, 2026');
		expect(formatDate('not-a-date')).toBe('');
		expect(formatDate()).toBe('');
	});
});
