// grain.social stores EXIF rational values as integers scaled by 1,000,000.
// e.g. ISO 12800 → 12800000000, ƒ/1.4 → 1400000, 1/80s → 12500.

export const EXIF_SCALE = 1_000_000;

export const MONTHS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

/** Known Sony body codes → friendly names. Falls back to the raw code. */
const CAMERA_NAMES: Record<string, string> = {
	'ILCE-7RM5': 'α7R V',
	'ILCE-7RM4': 'α7R IV',
	'ILCE-7RM3': 'α7R III',
	'ILCE-7M4': 'α7 IV',
	'ILCE-7M3': 'α7 III',
	'ILCE-9M3': 'α9 III',
	'ILCE-1': 'α1',
	'ILCE-7CM2': 'α7C II',
	'ILCE-7SM3': 'α7S III'
};

function titleCase(value: string): string {
	return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;
}

/** Round to at most 2 decimals and drop a trailing ".0" (2.0 → "2", 1.4 → "1.4"). */
function trimNumber(n: number): string {
	return String(Math.round(n * 100) / 100);
}

export function cameraName(make?: string, model?: string): string {
	if (!model) return make ? titleCase(make) : '';
	const pretty = CAMERA_NAMES[model] ?? model;
	const brand = make ? (make.toUpperCase() === 'SONY' ? 'Sony' : titleCase(make)) : '';
	return brand ? `${brand} ${pretty}` : pretty;
}

// "FE 50mm F1.4 GM" → "FE 50mm ƒ/1.4 GM"
const LENS_APERTURE = /F(\d)/;

export function lensName(lens?: string): string {
	return lens ? lens.replace(LENS_APERTURE, 'ƒ/$1') : '';
}

export function aperture(scaled?: number): string {
	if (!scaled) return '';
	return `ƒ/${trimNumber(scaled / EXIF_SCALE)}`;
}

export function iso(scaled?: number): string {
	if (!scaled) return '';
	return `ISO ${Math.round(scaled / EXIF_SCALE)}`;
}

export function focalLength(scaled?: number): string {
	if (!scaled) return '';
	return `${Math.round(scaled / EXIF_SCALE)}mm`;
}

export function shutter(scaledSeconds?: number): string {
	if (!scaledSeconds) return '';
	const seconds = scaledSeconds / EXIF_SCALE;
	if (seconds <= 0) return '';
	if (seconds < 1) return `1/${Math.round(1 / seconds)}`;
	return Number.isInteger(seconds) ? `${seconds}"` : `${seconds.toFixed(1)}"`;
}

/**
 * Scene brightness as an exposure value at ISO 100, from the settings that
 * exposed it: EV = log2(N²/t) − log2(ISO/100). Null unless all three are known.
 */
export function exposureValue(
	fNumber?: number,
	exposureTime?: number,
	scaledIso?: number
): number | null {
	if (!fNumber || !exposureTime || !scaledIso) return null;
	const n = fNumber / EXIF_SCALE;
	const seconds = exposureTime / EXIF_SCALE;
	return Math.log2((n * n) / seconds) - Math.log2(scaledIso / EXIF_SCALE / 100);
}

export function formatDate(value?: string): string {
	if (!value) return '';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '';
	return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
