// The newest thing on each site, for the site rail: one small read per
// collection, since all three sites keep their content in the same repo.
import { thumbUrl } from './cdn';
import { latestRecord, resolvePds } from './repo';
import type { BlobRef } from './types';

interface LatestImage {
	/** a CDN thumbnail */
	src: string;
	alt: string;
	/** the photo's aspect ratio, so its box is sized before it loads */
	width?: number;
	height?: number;
}

export interface LatestItem {
	/** what it is, as in "Newest post" */
	kind: 'post' | 'photo' | 'mix';
	/** photos have none */
	title?: string;
	/** photos only */
	image?: LatestImage;
	/** an ISO 8601 datetime */
	date: string;
}

/** Keyed by site; a site whose read failed, or that has nothing yet, is left out. */
export interface Latest {
	bnb?: LatestItem;
	camera?: LatestItem;
	dj?: LatestItem;
}

/** The fields the three collections date, name and picture their records with. */
interface Dated {
	title?: string;
	publishedAt?: string;
	createdAt?: string;
	photo?: BlobRef;
	alt?: string;
	aspectRatio?: { width: number; height: number };
}

async function newest(
	fetchFn: typeof fetch,
	pds: string,
	collection: string,
	kind: LatestItem['kind']
): Promise<LatestItem | undefined> {
	const value = (await latestRecord<Dated>(fetchFn, pds, collection))?.value;
	const date = value?.publishedAt ?? value?.createdAt;
	if (!value || !date) return undefined;
	const cid = value.photo?.ref?.$link;
	return {
		kind,
		date,
		...(value.title && { title: value.title }),
		...(cid && { image: { src: thumbUrl(cid), alt: value.alt ?? '', ...value.aspectRatio } })
	};
}

/**
 * The newest post (bnb.im), photo (tierney.camera) and mix (tierneycyren.com).
 * Never rejects: a failed read just leaves that site out.
 */
export async function loadLatest(fetchFn: typeof fetch): Promise<Latest> {
	const pds = await resolvePds(fetchFn);
	const read = (collection: string, kind: LatestItem['kind']) =>
		newest(fetchFn, pds, collection, kind).catch(() => undefined);

	const [bnb, camera, dj] = await Promise.all([
		read('site.standard.document', 'post'),
		read('social.grain.photo', 'photo'),
		read('fm.plyr.track', 'mix')
	]);
	return { ...(bnb && { bnb }), ...(camera && { camera }), ...(dj && { dj }) };
}
