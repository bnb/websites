import type { PageServerLoad } from './$types';
import { DEFAULT_PDS } from '$lib/atproto';
import { likeCounts } from '$lib/server/likes';
import { palettesFor } from '$lib/server/palette';
import { portfolio } from '$lib/server/portfolio';

// The portfolio is read live from the AT Protocol on the server (great for SEO and
// first paint), held in a short in-memory cache, and cached briefly at the edge.
// Colour strips come with whichever palettes are ready; the rest follow on a later render.
// Like counts come from a cache of their own, refreshed on the same rhythm.
export const load: PageServerLoad = async ({ setHeaders }) => {
	try {
		const [data, likes] = await Promise.all([portfolio.get(), likeCounts.get()]);
		setHeaders({
			'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'
		});
		return {
			...data,
			likes,
			palettes: palettesFor(data.photos.map((photo) => photo.cid)),
			loadError: false
		};
	} catch (error) {
		console.error('Failed to read the portfolio from the AT Protocol', error);
		// the outage page answers 200, so keep crawlers from indexing it in place of the work
		setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
		return {
			profile: null,
			photos: [],
			pds: DEFAULT_PDS,
			likes: {},
			palettes: {},
			loadError: true
		};
	}
};
