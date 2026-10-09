import { coverAt } from './plyr';
import { NAME, SITE_NAME } from './site';
import type { Mix } from './types';

/** Artwork sizes for the lock screen and media notifications. */
const ARTWORK = [256, 512];

/** What the lock screen and media notifications show for a mix (Media Session API). */
export function sessionMetadata(mix: Mix): MediaMetadataInit {
	return {
		title: mix.title,
		artist: mix.artist || NAME,
		album: SITE_NAME,
		artwork: mix.image
			? ARTWORK.map((size) => ({ src: coverAt(mix.image, size), sizes: `${size}x${size}` }))
			: []
	};
}
