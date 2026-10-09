import { describe, expect, it } from 'vitest';
import { deterministicTid } from './tid';

const S32 = '234567abcdefghijklmnopqrstuvwxyz';
const TID = /^[234567a-j][234567a-z]{12}$/;

// a TID back into its timestamp and clock id
function decode(tid: string) {
	let value = 0n;
	for (const char of tid) value = value * 32n + BigInt(S32.indexOf(char));
	return { micros: value >> 10n, clockId: Number(value & 1023n) };
}

describe('deterministicTid', () => {
	// what the original JavaScript deterministicTid gives the same inputs, so a
	// post keeps its URI moving from the plugin to this package
	it.each([
		['2026-10-02T00:00:00Z', 'what-is-the-atmosphere', 0, '3mwu2vee2225z'],
		['2026-10-02T00:00:00Z', 'what-is-the-atmosphere', 1, '3mwu2vee22262'],
		['2026-10-02T00:00:00Z', 'post', 0, '3mwu2vee222l5'],
		['2026-10-02T00:00:00Z', 'post', 1023, '3mwu2vee222l4'],
		['1970-01-01T00:00:00Z', '', 0, '22222222222xk'],
		['2024-02-29T12:34:56.789Z', 'leap-day', 5, '3kmklyeotkcsp']
	])('matches the plugin for %s, %j, bump %i', (date, key, bump, tid) => {
		expect(deterministicTid(new Date(date), key, bump)).toBe(tid);
	});

	it('encodes the date in microseconds, as a valid TID', () => {
		const date = new Date('2026-10-02T12:34:56.789Z');
		const tid = deterministicTid(date, 'what-is-the-atmosphere');
		expect(tid).toMatch(TID);
		expect(decode(tid).micros).toBe(BigInt(date.getTime()) * 1000n);
	});

	it('is stable for a key, and differs between keys', () => {
		const date = new Date('2026-10-02T00:00:00Z');
		expect(deterministicTid(date, 'post')).toBe(deterministicTid(date, 'post'));
		expect(deterministicTid(date, 'post')).not.toBe(deterministicTid(date, 'other-post'));
		expect(deterministicTid(date, 'post', 0)).toBe(deterministicTid(date, 'post'));
	});

	it('bumps the clock id, wrapping at 1024, to step around collisions', () => {
		const date = new Date('2026-10-02T00:00:00Z');
		const first = decode(deterministicTid(date, 'post')).clockId;
		expect(decode(deterministicTid(date, 'post', 1)).clockId).toBe((first + 1) % 1024);
		expect(decode(deterministicTid(date, 'post', 1024)).clockId).toBe(first);
		expect(decode(deterministicTid(date, 'post', 1023)).micros).toBe(
			decode(deterministicTid(date, 'post')).micros
		);
	});

	it('sorts by date', () => {
		const earlier = deterministicTid(new Date('2025-01-01T00:00:00Z'), 'zzz');
		const later = deterministicTid(new Date('2025-01-01T00:00:00.001Z'), 'aaa');
		expect(earlier < later).toBe(true);
	});
});
