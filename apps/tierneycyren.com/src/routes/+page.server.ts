import { DEFAULT_PDS } from '@bnb/atproto';
import { crate } from '$lib/server/crate';
import type { PageServerLoad } from './$types';

// The mixes are read live from the AT Protocol on the server, held in a short
// in-memory cache, and cached briefly at the edge.
export const load: PageServerLoad = async ({ setHeaders }) => {
	try {
		const data = await crate.get();
		setHeaders({
			'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'
		});
		return { ...data, loadError: false };
	} catch (error) {
		console.error('Failed to read the mixes from the AT Protocol', error);
		// the outage page answers 200, so keep crawlers from indexing it
		setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
		return { bio: '', profile: null, mixes: [], pds: DEFAULT_PDS, loadError: true };
	}
};
