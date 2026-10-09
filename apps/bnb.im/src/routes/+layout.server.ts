import { loadLatest } from '@bnb/atproto';
import { fetchWithTimeout, swrCache } from '@bnb/kit/server';
import { loadPosts, topics } from '$lib/server/posts';
import { headTags } from '$lib/server/standard-site';
import type { LayoutServerLoad } from './$types';

/** A hung PDS shouldn't hold up the build; the rail just goes without. */
const REQUEST_TIMEOUT_MS = 3_000;

/**
 * Each site's newest item, for the site rail. The pages are prerendered, so
 * this is read once a build (the cache shares it across every page) and is as
 * fresh as the last deploy.
 */
const latest = swrCache(() => loadLatest(fetchWithTimeout(REQUEST_TIMEOUT_MS)), {
	freshMs: 5 * 60_000
});

export const load: LayoutServerLoad = async () => ({
	topics: topics(loadPosts()),
	atTags: headTags(),
	// loadLatest never rejects: a site it can't read is just left out
	latest: await latest.get()
});
