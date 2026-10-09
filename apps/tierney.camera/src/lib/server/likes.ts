import { countLinks } from '@bnb/atmosphere';
import { swrCache } from '@bnb/kit/server';
import { FAVORITE } from '../site';
import type { LikeCounts, Photo } from '../types';
import { portfolio, REQUEST_TIMEOUT_MS } from './portfolio';

/**
 * Constellation's count of the social.grain.favorite records pointing at each
 * photograph's gallery: one request per gallery. A gallery it can't count is
 * left out, so its heart shows no number.
 */
async function count(photos: Photo[]): Promise<LikeCounts> {
	const galleries = [...new Set(photos.flatMap((photo) => photo.gallery ?? []))];
	const counts = await Promise.all(
		galleries.map((target) =>
			countLinks(
				{ target, collection: FAVORITE, path: '.subject' },
				{ timeout: REQUEST_TIMEOUT_MS }
			).then(
				(total): [string, number] => [target, total],
				() => null
			)
		)
	);
	return Object.fromEntries(counts.filter((entry) => entry !== null));
}

/** How many people have liked each gallery on grain.social, by gallery uri, re-read at most every five minutes. */
export const likeCounts = swrCache(async () => count((await portfolio.get()).photos), {
	freshMs: 5 * 60_000
});
