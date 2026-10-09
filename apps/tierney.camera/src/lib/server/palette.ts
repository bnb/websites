import sharp from 'sharp';
import { dominantColours } from '../palette';
import type { Swatch } from '../types';
import { thumbnail } from './thumbnail';

// Each photograph's dominant colours, read from its CDN thumbnail. Blobs are
// content-addressed, so a CID's palette never changes: it's kept for the life
// of the process, and each thumbnail is fetched once. Pages never wait on this:
// they get whatever palettes are ready, and missing ones are worked out in the
// background, a few at a time, for the next render.

const COLOURS = 5;
/** Thumbnails read at once. */
const CONCURRENCY = 4;
/** Thumbnails are shrunk to fit this square first: plenty for a strip of five colours. */
const SAMPLE_PX = 32;
/** How long a photograph whose thumbnail couldn't be read waits before it's tried again. */
const RETRY_MS = 10 * 60_000;

const palettes = new Map<string, Swatch[]>();
const failedAt = new Map<string, number>();
/** Queued or being read. */
const pending = new Set<string>();
const queue: string[] = [];
let reading = 0;

async function read(cid: string): Promise<Swatch[]> {
	const { data, info } = await sharp(await thumbnail(cid))
		.resize(SAMPLE_PX, SAMPLE_PX, { fit: 'inside' })
		.raw()
		.toBuffer({ resolveWithObject: true });
	return dominantColours(data, info.channels, COLOURS);
}

function pump() {
	while (reading < CONCURRENCY) {
		const cid = queue.shift();
		if (!cid) return;
		reading++;
		read(cid)
			.then(
				(palette) => palettes.set(cid, palette),
				(error: unknown) => {
					failedAt.set(cid, Date.now());
					console.error(`Couldn't read the colours of ${cid}`, error);
				}
			)
			.finally(() => {
				reading--;
				pending.delete(cid);
				pump();
			});
	}
}

/**
 * The palettes ready for these photographs, by CID, right away. Any that
 * aren't ready are queued to be read in the background.
 */
export function palettesFor(cids: readonly string[]): Record<string, Swatch[]> {
	const ready: Record<string, Swatch[]> = {};
	for (const cid of cids) {
		const palette = palettes.get(cid);
		if (palette) {
			ready[cid] = palette;
			continue;
		}
		const failedRecently = Date.now() - (failedAt.get(cid) ?? -Infinity) < RETRY_MS;
		if (pending.has(cid) || failedRecently) continue;
		pending.add(cid);
		queue.push(cid);
	}
	pump();
	return ready;
}
