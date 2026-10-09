// Dates are read and shown in UTC (a front matter date like
// 2021-06-16 is midnight UTC).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** 2026-10-02 → "02 Oct 2026" */
export function readableDate(date: Date): string {
	return `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** 2026-10-02 → "2026-10-02", for <time datetime> */
export function htmlDate(date: Date): string {
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** 2025-10-30 → "30.10.2025", for the post meta strip */
export function dotDate(date: Date): string {
	return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
}

export function year(date: Date): string {
	return String(date.getUTCFullYear());
}

/** RFC 3339 without milliseconds, for Atom: "2026-10-02T00:00:00Z" */
export function rfc3339(date: Date): string {
	return `${date.toISOString().split('.')[0]}Z`;
}
