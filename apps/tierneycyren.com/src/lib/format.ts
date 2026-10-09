import type { Mix } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Seconds as a running time: 1335 → "22:15", 3725 → "1:02:05". */
export function runningTime(seconds: number): string {
	if (!seconds || seconds < 0) return '';
	const s = Math.round(seconds);
	const hours = Math.floor(s / 3600);
	const minutes = Math.floor((s % 3600) / 60);
	return hours ? `${hours}:${pad(minutes)}:${pad(s % 60)}` : `${minutes}:${pad(s % 60)}`;
}

/** Seconds as an ISO 8601 duration for <time datetime>: 1335 → "PT22M15S". */
export function isoDuration(seconds: number): string {
	const s = Math.max(0, Math.round(seconds));
	const hours = Math.floor(s / 3600);
	const minutes = Math.floor((s % 3600) / 60);
	return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}${s % 60}S`;
}

/** A posted date, in UTC: "2026-08-25T23:53:12Z" → "Aug 25, 2026". */
export function postedDate(value?: string): string {
	if (!value) return '';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '';
	return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Two-digit mix number, counting up from the oldest: the newest of 12 is "12". */
export function mixNumber(index: number, total: number): string {
	return pad(total - index);
}

/** Total running time across mixes, in hours and minutes: "1 hr 19 min", "22 min". */
export function totalTime(mixes: readonly Mix[]): string {
	const minutes = Math.round(mixes.reduce((sum, mix) => sum + mix.duration, 0) / 60);
	if (!minutes) return '';
	const hours = Math.floor(minutes / 60);
	return hours ? `${hours} hr ${minutes % 60} min` : `${minutes} min`;
}

/** The marquee: the bio, then each mix's title. */
export function marqueeItems(bio: string, mixes: readonly Mix[]): string[] {
	return [bio, ...mixes.map((mix) => mix.title)].filter(Boolean);
}

/** The mix count and running time: "2 mixes · 1 hr 19 min", or "" for none. */
export function mixSummary(mixes: readonly Mix[]): string {
	if (!mixes.length) return '';
	const count = `${mixes.length} ${mixes.length === 1 ? 'mix' : 'mixes'}`;
	return [count, totalTime(mixes)].filter(Boolean).join(' · ');
}

/** A mix's length on the scale the longest one sets, 0–1 (0 when unknown). */
export function lengthScale(duration: number, longest: number): number {
	return longest > 0 ? duration / longest : 0;
}
