import type { Photo, Profile } from './types';
import { MONTHS } from './exif';

// Display helpers for the flyer: captions, the ticker band and the footer facts.
// All pure, so they're unit-tested without a browser.

const US_STATES: Record<string, string> = {
	Alabama: 'AL',
	Alaska: 'AK',
	Arizona: 'AZ',
	Arkansas: 'AR',
	California: 'CA',
	Colorado: 'CO',
	Connecticut: 'CT',
	Delaware: 'DE',
	'District of Columbia': 'DC',
	Florida: 'FL',
	Georgia: 'GA',
	Hawaii: 'HI',
	Idaho: 'ID',
	Illinois: 'IL',
	Indiana: 'IN',
	Iowa: 'IA',
	Kansas: 'KS',
	Kentucky: 'KY',
	Louisiana: 'LA',
	Maine: 'ME',
	Maryland: 'MD',
	Massachusetts: 'MA',
	Michigan: 'MI',
	Minnesota: 'MN',
	Mississippi: 'MS',
	Missouri: 'MO',
	Montana: 'MT',
	Nebraska: 'NE',
	Nevada: 'NV',
	'New Hampshire': 'NH',
	'New Jersey': 'NJ',
	'New Mexico': 'NM',
	'New York': 'NY',
	'North Carolina': 'NC',
	'North Dakota': 'ND',
	Ohio: 'OH',
	Oklahoma: 'OK',
	Oregon: 'OR',
	Pennsylvania: 'PA',
	'Rhode Island': 'RI',
	'South Carolina': 'SC',
	'South Dakota': 'SD',
	Tennessee: 'TN',
	Texas: 'TX',
	Utah: 'UT',
	Vermont: 'VT',
	Virginia: 'VA',
	Washington: 'WA',
	'West Virginia': 'WV',
	Wisconsin: 'WI',
	Wyoming: 'WY'
};

const NON_DIGITS = /\D/g;
const SPACES = /\s+/;

const twoDigits = (n: number) => String(n).padStart(2, '0');
const monthYear = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/** The name the site goes by: the grain profile's display name, else "tierney cyren". */
export function personName(profile: Profile | null): string {
	return (profile?.displayName ?? '').trim() || 'tierney cyren';
}

/** The name in the masthead's lines: the last word on a line of its own ("tierney cyren" → ["tierney", "cyren"]). */
export function nameLines(name: string): string[] {
	const words = name.split(SPACES);
	return words.length > 1 ? [words.slice(0, -1).join(' '), words.at(-1) ?? ''] : [name];
}

/** Two-digit frame number for a zero-based index: 0 → "01". */
export function frameNumber(index: number): string {
	return String(index + 1).padStart(2, '0');
}

/** "Bushwick, New York" → "Bushwick, NY". Non-US regions are left as they are. */
export function shortPlace(place: string): string {
	const parts = place
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	const region = parts.at(-1);
	if (parts.length > 1 && region && US_STATES[region]) parts[parts.length - 1] = US_STATES[region];
	return parts.join(', ');
}

/** "Bushwick, New York" → "Bushwick". */
export function placeHead(place: string): string {
	return place.split(',')[0]?.trim() ?? '';
}

/** Capture date as a flyer-style stamp, in UTC: "2026-07-09T14:00:50Z" → "07.09.26". */
export function stampDate(value?: string): string {
	if (!value) return '';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '';
	return `${twoDigits(d.getUTCMonth() + 1)}.${twoDigits(d.getUTCDate())}.${twoDigits(d.getUTCFullYear() % 100)}`;
}

/** Exposure line for a caption; `compact` keeps just aperture + ISO for small cells. */
export function exposure(photo: Photo, compact = false): string {
	const parts = compact
		? [photo.aperture, photo.iso]
		: [photo.focal, photo.aperture, photo.shutter, photo.iso];
	return parts.filter(Boolean).join(' ');
}

/** A light-meter reading to one decimal: 1.56 → "EV 1.6". */
export function formatEv(ev: number): string {
	return `EV ${(Math.round(ev * 10) / 10).toFixed(1)}`;
}

function isoNumber(iso: string): number {
	return Number(iso.replace(NON_DIGITS, '')) || 0;
}

/** The highest ISO in the set ("ISO 12800"), or "" when no photo has one. */
export function peakIso(photos: readonly Photo[]): string {
	let best = '';
	for (const photo of photos) {
		if (isoNumber(photo.iso) > isoNumber(best)) best = photo.iso;
	}
	return best;
}

/** Capture-date span by month: "Aug 2026", "May – Aug 2026" or "Nov 2025 – Aug 2026". */
export function monthRange(photos: readonly Photo[]): string {
	const times = photos
		.map((photo) => new Date(photo.date).getTime())
		.filter((time) => !Number.isNaN(time));
	if (!times.length) return '';
	const first = new Date(Math.min(...times));
	const last = new Date(Math.max(...times));
	if (monthYear(first) === monthYear(last)) return monthYear(last);
	if (first.getUTCFullYear() === last.getUTCFullYear()) {
		return `${MONTHS[first.getUTCMonth()]} – ${monthYear(last)}`;
	}
	return `${monthYear(first)} – ${monthYear(last)}`;
}

function unique(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

/** Every camera body and lens used, bodies first. */
export function kit(photos: readonly Photo[]): string[] {
	return [
		...unique(photos.map((photo) => photo.camera)),
		...unique(photos.map((photo) => photo.lens))
	];
}

/** The ticker band: places, then kit, then the highest ISO. */
export function tickerItems(photos: readonly Photo[]): string[] {
	return [
		...unique(photos.map((photo) => placeHead(photo.place))),
		...kit(photos),
		peakIso(photos)
	].filter(Boolean);
}
