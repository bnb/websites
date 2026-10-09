import { describe, expect, it } from 'vitest';
import { dotDate, htmlDate, readableDate, rfc3339, year } from './dates';

// front matter dates are midnight UTC; a time late in the UTC day checks that
// nothing slips into the local time zone
const date = new Date('2026-10-02T23:30:00Z');

describe('dates', () => {
	it('formats a readable date with a zero-padded day and short month', () => {
		expect(readableDate(date)).toBe('02 Oct 2026');
		expect(readableDate(new Date('2019-04-15'))).toBe('15 Apr 2019');
		expect(readableDate(new Date('2021-01-01'))).toBe('01 Jan 2021');
		expect(readableDate(new Date('2021-12-31'))).toBe('31 Dec 2021');
	});

	it('formats a <time datetime> date as yyyy-mm-dd', () => {
		expect(htmlDate(date)).toBe('2026-10-02');
		expect(htmlDate(new Date('2021-06-05'))).toBe('2021-06-05');
	});

	it('formats the post meta date as dd.mm.yyyy', () => {
		expect(dotDate(new Date('2025-10-30'))).toBe('30.10.2025');
		expect(dotDate(new Date('2021-06-05'))).toBe('05.06.2021');
	});

	it('gives the UTC year', () => {
		expect(year(new Date('2019-12-31T23:59:59Z'))).toBe('2019');
		expect(year(date)).toBe('2026');
	});

	it('formats RFC 3339 without milliseconds, for Atom', () => {
		expect(rfc3339(new Date('2026-10-02'))).toBe('2026-10-02T00:00:00Z');
		expect(rfc3339(new Date('2020-04-09T12:34:56.789Z'))).toBe('2020-04-09T12:34:56Z');
	});
});
