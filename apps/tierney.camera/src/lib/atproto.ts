import { getRecord, listRecords, resolvePds, type AtpRecord } from '@bnb/atproto';
import type {
	ExifRecord,
	GalleryItemRecord,
	GalleryRecord,
	Photo,
	PhotoRecord,
	Portfolio,
	Profile,
	ProfileRecord
} from './types';
import { aperture, cameraName, exposureValue, focalLength, iso, lensName, shutter } from './exif';

// The account, its PDS resolution, paginated reads and image URLs are shared
// by every site (@bnb/atproto); what's here is grain.social's.
export { DEFAULT_PDS, DID, HANDLE, blobUrl, fullUrl, thumbUrl } from '@bnb/atproto';

type FetchLike = typeof fetch;

async function getProfile(fetchFn: FetchLike, pds: string): Promise<Profile | null> {
	const v = await getRecord<ProfileRecord>(fetchFn, pds, 'social.grain.actor.profile', 'self');
	if (!v) return null;
	return {
		displayName: v.displayName ?? '',
		description: v.description ?? '',
		avatarCid: v.avatar?.ref?.$link ?? null
	};
}

// ── assembly (pure) ──────────────────────────────────────────────────────────

export interface RawRecords {
	photos: AtpRecord<PhotoRecord>[];
	exifs: AtpRecord<ExifRecord>[];
	galleryItems: AtpRecord<GalleryItemRecord>[];
	galleries: AtpRecord<GalleryRecord>[];
}

function placeName(gallery?: GalleryRecord): string {
	if (!gallery) return '';
	const primary = [gallery.location?.name, gallery.address?.region].filter(Boolean) as string[];
	if (primary.length) return primary.join(', ');
	const fallback = [gallery.address?.locality, gallery.address?.region].filter(Boolean) as string[];
	return fallback.join(', ');
}

/**
 * Join photos with their EXIF and gallery location, newest posted first.
 * Pure and side-effect free, so it can be unit-tested without any network.
 */
export function assemblePhotos(raw: RawRecords): Photo[] {
	const exifByPhoto = new Map(raw.exifs.map((r) => [r.value.photo, r.value]));
	const galleryByUri = new Map(raw.galleries.map((r) => [r.uri, r.value]));
	// each photo's gallery URI, for the galleries that exist
	const galleryOf = new Map<string, string>();
	for (const gi of raw.galleryItems) {
		if (galleryByUri.has(gi.value.gallery)) galleryOf.set(gi.value.item, gi.value.gallery);
	}

	const photos: Photo[] = [];
	for (const rec of raw.photos) {
		const cid = rec.value.photo?.ref?.$link;
		if (!cid) continue;

		const e = exifByPhoto.get(rec.uri);
		const ar = rec.value.aspectRatio;
		const gallery = galleryOf.get(rec.uri);

		photos.push({
			uri: rec.uri,
			cid,
			width: ar?.width ?? 3,
			height: ar?.height ?? 2,
			alt: rec.value.alt ?? '',
			date: e?.dateTimeOriginal ?? rec.value.createdAt ?? '',
			posted: rec.value.createdAt ?? '',
			place: placeName(gallery ? galleryByUri.get(gallery) : undefined),
			...(gallery && { gallery }),
			camera: cameraName(e?.make, e?.model),
			lens: lensName(e?.lensModel),
			focal: focalLength(e?.focalLengthIn35mmFormat),
			aperture: aperture(e?.fNumber),
			shutter: shutter(e?.exposureTime),
			iso: iso(e?.iSO),
			ev: exposureValue(e?.fNumber, e?.exposureTime, e?.iSO)
		});
	}

	photos.sort((a, b) => b.posted.localeCompare(a.posted));
	return photos;
}

// ── orchestration ────────────────────────────────────────────────────────────

/** Read the whole portfolio live from the AT Protocol. Inject `fetch` for SSR. */
export async function loadPortfolio(fetchFn: FetchLike): Promise<Portfolio> {
	const pds = await resolvePds(fetchFn);

	const [photos, exifs, galleryItems, galleries, profile] = await Promise.all([
		listRecords<PhotoRecord>(fetchFn, pds, 'social.grain.photo'),
		listRecords<ExifRecord>(fetchFn, pds, 'social.grain.photo.exif').catch(() => []),
		listRecords<GalleryItemRecord>(fetchFn, pds, 'social.grain.gallery.item').catch(() => []),
		listRecords<GalleryRecord>(fetchFn, pds, 'social.grain.gallery').catch(() => []),
		getProfile(fetchFn, pds)
	]);

	return {
		profile,
		photos: assemblePhotos({ photos, exifs, galleryItems, galleries }),
		pds
	};
}
