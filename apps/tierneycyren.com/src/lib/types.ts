import type { BlobRef } from '@bnb/atproto';

export type { AtpRecord } from '@bnb/atproto';

// ── Raw AT Protocol record shapes (plyr.fm lexicons) ───────────────────────

export interface TrackRecord {
	$type: 'fm.plyr.track';
	title: string;
	artist?: string;
	/** plyr.fm's CDN copy of the audio */
	audioUrl?: string;
	/** seconds */
	duration?: number;
	fileType?: string;
	imageUrl?: string;
	/** the audio itself, in the repository */
	audioBlob?: BlobRef;
	description?: string;
	createdAt: string;
}

export interface PlyrProfileRecord {
	$type: 'fm.plyr.actor.profile';
	bio?: string;
}

// ── Assembled, render-ready view models ────────────────────────────────────

/** One mix, ready to render. */
export interface Mix {
	/** at:// uri of the track record */
	uri: string;
	title: string;
	artist: string;
	/** where to stream it from, in order: plyr.fm's CDN, then the PDS */
	sources: string[];
	/** e.g. "audio/mpeg" */
	mimeType: string;
	/** e.g. "MP3" */
	format: string;
	/** seconds; 0 when unknown */
	duration: number;
	/** cover art, or "" */
	image: string;
	/** ISO date it was posted */
	date: string;
	description: string;
}

/** Everything the page shows: a DJ's crate. */
export interface Crate {
	bio: string;
	/** at:// uri of the plyr.fm profile record, or null when there isn't one */
	profile: string | null;
	mixes: Mix[];
	/** the account's resolved PDS host, used for raw-blob fallback urls */
	pds: string;
}
