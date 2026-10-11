import { fetchWithTimeout, swrCache } from '@bnb/kit/server';
import { log } from 'evlog';
import { loadPortfolio } from '../atproto';

/** Each request to the AT Protocol or its CDN gives up after this long, so a hung host can't stall a page. */
export const REQUEST_TIMEOUT_MS = 8_000;

/** The portfolio, re-read from the AT Protocol at most every five minutes. */
export const portfolio = swrCache(() => loadPortfolio(fetchWithTimeout(REQUEST_TIMEOUT_MS)), {
	freshMs: 5 * 60_000,
	onError: (error) => log.error({ portfolio: { refresh: 'failed' }, error })
});
