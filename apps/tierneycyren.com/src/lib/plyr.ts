import { blobUrl, getRecord, listRecords, recordUri, resolvePds } from '@bnb/atproto';
import type { AtpRecord, Crate, Mix, PlyrProfileRecord, TrackRecord } from './types';

// The mixes are fm.plyr.track records in the account's own repository; plyr.fm
// (https://plyr.fm) is the app that uploads them. As with tierney.camera's
// grain.social photos, nothing is uploaded to the site itself.

const MIME_TYPES: Record<string, string> = {
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	flac: 'audio/flac',
	m4a: 'audio/mp4',
	aac: 'audio/aac',
	ogg: 'audio/ogg',
	opus: 'audio/ogg'
};

const HTTPS = /^https:\/\//;
const EXTENSION = /\.([a-z0-9]+)$/i;
const CRLF = /\r\n?/g;

const safeUrl = (url?: string) => (url && HTTPS.test(url) ? url : '');

/**
 * Tracks into mixes, newest first. Pure, so it's unit-tested without a network.
 * A track with nowhere to stream it from is dropped.
 */
export function assembleMixes(tracks: AtpRecord<TrackRecord>[], pds: string): Mix[] {
	const mixes: Mix[] = [];
	for (const { uri, value } of tracks) {
		const cid = value.audioBlob?.ref?.$link;
		const sources = [safeUrl(value.audioUrl), cid ? blobUrl(pds, cid) : ''].filter(Boolean);
		if (!sources.length || !value.title) continue;

		const extension = (
			value.fileType ||
			EXTENSION.exec(value.audioUrl ?? '')?.[1] ||
			''
		).toLowerCase();
		mixes.push({
			uri,
			title: value.title,
			artist: value.artist ?? '',
			sources,
			mimeType: value.audioBlob?.mimeType || MIME_TYPES[extension] || '',
			format: extension.toUpperCase(),
			duration: Math.max(0, Math.round(value.duration ?? 0)),
			image: safeUrl(value.imageUrl),
			date: value.createdAt ?? '',
			description: (value.description ?? '').replace(CRLF, '\n').trim()
		});
	}
	return mixes.toSorted((a, b) => b.date.localeCompare(a.date));
}

const PLYR_IMAGES = /^https:\/\/images\.plyr\.fm\//;

/**
 * Cover art at a given width, through Cloudflare's image resizing on plyr.fm's
 * image host (an original can run to several megabytes). Covers hosted
 * anywhere else are used as they are.
 */
export function coverAt(image: string, width: number): string {
	if (!PLYR_IMAGES.test(image)) return image;
	return image.replace(
		PLYR_IMAGES,
		`https://images.plyr.fm/cdn-cgi/image/width=${width},format=auto/`
	);
}

/** Read the mixes and the plyr.fm bio live from the AT Protocol. Inject `fetch` for SSR. */
export async function loadCrate(fetchFn: typeof fetch): Promise<Crate> {
	const pds = await resolvePds(fetchFn);
	const [tracks, profile] = await Promise.all([
		listRecords<TrackRecord>(fetchFn, pds, 'fm.plyr.track'),
		getRecord<PlyrProfileRecord>(fetchFn, pds, 'fm.plyr.actor.profile', 'self')
	]);
	return {
		bio: (profile?.bio ?? '').trim(),
		profile: profile ? recordUri('fm.plyr.actor.profile', 'self') : null,
		mixes: assembleMixes(tracks, pds),
		pds
	};
}
