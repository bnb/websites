import type { RequestHandler } from './$types';
import { exposure, personName, shortPlace, stampDate } from '$lib/format';
import { pickFeatured } from '$lib/layout';
import { renderCard } from '$lib/server/card';
import { portfolio } from '$lib/server/portfolio';
import { thumbnail } from '$lib/server/thumbnail';
import { FEATURED_CID } from '$lib/site';
import type { Photo } from '$lib/types';

// The share card the home page gives Open Graph and X: the featured photograph
// under the name. It's rendered once and kept in memory until something on it
// changes (another photograph is featured, say). If the PDS or the image CDN is
// down, a card in type alone stands in, cached briefly so the real one follows.
const FINISHED = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
const STAND_IN = 'public, max-age=300';

let finished: { key: string; png: Uint8Array<ArrayBuffer> } | undefined;

const png = (body: Uint8Array<ArrayBuffer>, cacheControl: string) =>
	new Response(body, { headers: { 'content-type': 'image/png', 'cache-control': cacheControl } });

export const GET: RequestHandler = async () => {
	const data = await portfolio.get().catch((error: unknown) => {
		console.error('The share card fell back to type: the AT Protocol is unreachable', error);
		return null;
	});
	const name = personName(data?.profile ?? null);
	const photos = data?.photos ?? [];
	const featured: Photo | undefined = photos[pickFeatured(photos, FEATURED_CID)];
	// no photographs at all: the card in type is the real one
	if (!featured) {
		return png(await renderCard({ name, photo: null, caption: [] }), data ? FINISHED : STAND_IN);
	}

	const where = [shortPlace(featured.place), stampDate(featured.date)].filter(Boolean).join(' · ');
	const caption = [where, exposure(featured)].filter(Boolean);
	const key = JSON.stringify([featured.cid, name, caption]);
	if (finished?.key === key) return png(finished.png, FINISHED);

	const jpeg = await thumbnail(featured.cid).catch((error: unknown) => {
		console.error('The share card fell back to type: the image CDN is unreachable', error);
		return null;
	});
	if (!jpeg) return png(await renderCard({ name, photo: null, caption: [] }), STAND_IN);

	const photo = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
	finished = { key, png: await renderCard({ name, photo, caption }) };
	return png(finished.png, FINISHED);
};
