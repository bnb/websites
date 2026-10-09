// ── Raw AT Protocol record shapes (grain.social lexicons) ──────────────────

import type { BlobRef } from '@bnb/atproto';

export type { AtpRecord } from '@bnb/atproto';

export interface AspectRatio {
	width: number;
	height: number;
}

export interface PhotoRecord {
	$type: 'social.grain.photo';
	photo: BlobRef;
	aspectRatio?: AspectRatio;
	alt?: string;
	createdAt: string;
}

export interface ExifRecord {
	$type: 'social.grain.photo.exif';
	/** at:// uri of the photo this EXIF belongs to */
	photo: string;
	make?: string;
	model?: string;
	lensMake?: string;
	lensModel?: string;
	iSO?: number;
	fNumber?: number;
	exposureTime?: number;
	focalLengthIn35mmFormat?: number;
	flash?: string;
	dateTimeOriginal?: string;
	createdAt?: string;
}

export interface GalleryRecord {
	$type: 'social.grain.gallery';
	title?: string;
	description?: string;
	location?: { name?: string; value?: string };
	address?: { locality?: string; region?: string; country?: string; postalCode?: string };
	createdAt: string;
}

export interface GalleryItemRecord {
	$type: 'social.grain.gallery.item';
	/** photo uri */
	item: string;
	/** gallery uri */
	gallery: string;
	position?: number;
	createdAt: string;
}

export interface ProfileRecord {
	$type: 'social.grain.actor.profile';
	displayName?: string;
	description?: string;
	avatar?: BlobRef;
}

// ── Assembled, render-ready view models ────────────────────────────────────

/** A fully-joined photograph, ready to render. */
export interface Photo {
	/** at:// uri of the photo record; unique, unlike the blob cid (the same file can be posted twice) */
	uri: string;
	/** blob cid of the image */
	cid: string;
	width: number;
	height: number;
	alt: string;
	/** ISO capture date: when the photo was taken (falls back to record createdAt) */
	date: string;
	/** ISO posted date: when the photo record was created in the repo (drives sort order) */
	posted: string;
	/** e.g. "Bushwick, New York" */
	place: string;
	/** at:// uri of its social.grain.gallery: what a like on grain.social favorites (every photo here has its own) */
	gallery?: string;
	/** e.g. "Sony α7R IV" */
	camera: string;
	/** e.g. "FE 50mm ƒ/1.4 GM" */
	lens: string;
	/** e.g. "50mm" */
	focal: string;
	/** e.g. "ƒ/1.4" */
	aperture: string;
	/** e.g. "1/80" */
	shutter: string;
	/** e.g. "ISO 12800" */
	iso: string;
	/** scene brightness as EV at ISO 100 (about 1.6 for ƒ/2.2, 1/80, ISO 12800); null without all three */
	ev: number | null;
}

/** One of a photograph's dominant colours, and how much of the frame it covers (0 to 1). */
export interface Swatch {
	hex: string;
	share: number;
}

export interface Profile {
	displayName: string;
	description: string;
	avatarCid: string | null;
}

export interface Portfolio {
	profile: Profile | null;
	photos: Photo[];
	/** the account's resolved PDS host, used for raw-blob fallback urls */
	pds: string;
}

/** How many people have liked each gallery on grain.social, by gallery uri, for those Constellation could count. */
export type LikeCounts = Record<string, number>;
