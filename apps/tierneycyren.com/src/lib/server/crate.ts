import { fetchWithTimeout, swrCache } from '@bnb/kit/server';
import { loadCrate } from '../plyr';

/** Each AT Protocol request gives up after this long, so a hung PDS can't stall a page. */
export const REQUEST_TIMEOUT_MS = 8_000;

/** The mixes, re-read from the AT Protocol at most every five minutes. */
export const crate = swrCache(() => loadCrate(fetchWithTimeout(REQUEST_TIMEOUT_MS)), {
	freshMs: 5 * 60_000,
	onError: (error) => console.error('Background refresh from the AT Protocol failed', error)
});
