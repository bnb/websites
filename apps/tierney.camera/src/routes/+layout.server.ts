import { loadLatest } from '@bnb/atproto';
import { fetchWithTimeout, swrCache } from '@bnb/kit/server';
import type { LayoutServerLoad } from './$types';

/** The rail's extras aren't worth holding a page for, so they give up sooner than the page's own reads. */
const REQUEST_TIMEOUT_MS = 3_000;

/** Each site's newest item, for the site rail, re-read at most every five minutes. */
const latest = swrCache(() => loadLatest(fetchWithTimeout(REQUEST_TIMEOUT_MS)), {
	freshMs: 5 * 60_000
});

// loadLatest never rejects: a site it can't read is just left out
export const load: LayoutServerLoad = async () => ({ latest: await latest.get() });
