// What the lasers, the spectrum strip and the strobe read from the music. Pure
// functions over an AnalyserNode's byte frequency data (0–255 per bin), so
// they're unit-tested without Web Audio.

/** Mean level of the bins between `low` and `high` Hz (the kick drum by default), 0–1. */
export function energy(bins: Uint8Array, binHz: number, low = 40, high = 160): number {
	const from = Math.max(1, Math.floor(low / binHz));
	const to = Math.min(bins.length - 1, Math.max(from, Math.ceil(high / binHz)));
	let sum = 0;
	for (let i = from; i <= to; i++) sum += bins[i];
	return sum / ((to - from + 1) * 255);
}

/** `count` bands spaced like hearing (logarithmically) from `low` to `high` Hz, each its loudest bin, 0–1. */
export function bands(
	bins: Uint8Array,
	binHz: number,
	count: number,
	low = 50,
	high = 12_000
): number[] {
	const edge = (i: number) => Math.floor((low * (high / low) ** (i / count)) / binHz);
	return Array.from({ length: count }, (_, i) => {
		const from = Math.min(edge(i), bins.length - 1);
		const to = Math.min(Math.max(from, edge(i + 1) - 1), bins.length - 1);
		let peak = 0;
		for (let bin = from; bin <= to; bin++) peak = Math.max(peak, bins[bin]);
		return peak / 255;
	});
}

/** Eases `from` toward `to`: quick to rise with a hit, slow to fall away after it. */
export function follow(from: number, to: number): number {
	return from + (to - from) * (to > from ? 0.6 : 0.1);
}

/** A running average of `level` that takes about `windowMs` to catch up. */
export function settle(
	average: number,
	level: number,
	elapsedMs: number,
	windowMs = 3_000
): number {
	return average + (level - average) * Math.min(1, elapsedMs / windowMs);
}

/** A big bass hit: loud, and well above what the track has been doing lately (a drop). */
export function isHit(level: number, average: number): boolean {
	return level > 0.5 && level - average > 0.2;
}

/**
 * The shortest gap between two strobe flashes. WCAG 2.3.1 allows at most three
 * flashes in any one second, and with this gap a second holds at most three:
 * 0, 400 and 800 ms fit, and the next can't come until 1200.
 */
export const MIN_FLASH_GAP_MS = 400;

/** Whether the strobe may flash at `now`, given when it last did (if ever). */
export function canFlash(last: number | undefined, now: number): boolean {
	return last === undefined || now - last >= MIN_FLASH_GAP_MS;
}
