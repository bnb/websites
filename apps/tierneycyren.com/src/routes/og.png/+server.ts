import { fetchWithTimeout } from '@bnb/kit/server';
import { mixSummary } from '$lib/format';
import { coverAt } from '$lib/plyr';
import { fetchCover, renderCard } from '$lib/server/card';
import { crate, REQUEST_TIMEOUT_MS } from '$lib/server/crate';
import type { RequestHandler } from './$types';

/** The last complete card, and what it was drawn from. */
let cached: { key: string; png: Uint8Array<ArrayBuffer> } | undefined;

const send = (png: Uint8Array<ArrayBuffer>, complete: boolean) =>
	new Response(png, {
		headers: {
			'content-type': 'image/png',
			// the home page links ?v=<newest mix>, so a new mix is a new URL anyway
			'cache-control': complete ? 'public, max-age=3600, s-maxage=86400' : 'public, max-age=60'
		}
	});

// The share card, drawn on first request and kept in memory until the newest
// cover or the mix count changes. If the PDS or the cover can't be reached, a
// card without them is served briefly and redrawn on a later request.
export const GET: RequestHandler = async () => {
	const mixes = await crate.get().then(
		(data) => data.mixes,
		(error: unknown) => {
			console.error('Share card: failed to read the mixes from the AT Protocol', error);
			return null;
		}
	);
	const summary = mixes ? mixSummary(mixes) : '';
	const newest = mixes?.find((mix) => mix.image);
	const key = `${newest?.uri} ${newest?.image} ${summary}`;
	if (mixes && cached?.key === key) return send(cached.png, true);

	const cover = newest
		? await fetchCover(coverAt(newest.image, 600), fetchWithTimeout(REQUEST_TIMEOUT_MS))
		: null;
	const png = await renderCard({ cover, summary });
	const complete = !!mixes && (!newest || !!cover);
	if (complete) cached = { key, png };
	return send(png, complete);
};
