// Site-level settings that aren't read from the AT Protocol.
import { repoScope } from '@bnb/atmosphere';

export const SITE_URL = 'https://tierney.camera';
export const SITE_NAME = 'tierney.camera';
export const BASED_IN = 'New York City';

/**
 * The photograph shown large under the masthead. If it's ever deleted from the
 * repository, the layout falls back to the newest landscape photograph.
 */
export const FEATURED_CID = 'bafkreidfcru2lodcgegau3gy3fxtaswms3p7v37ioepfj4r7jkvd6bys24';

/** The share card at /og.png, the size Open Graph and X expect for a large image. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** grain.social's like: a record in the reader's own repo whose subject is a gallery. */
export const FAVORITE = 'social.grain.favorite';

/** What signing in lets the site do: create and delete the reader's likes, and nothing else. */
export const SCOPE = repoScope(FAVORITE);
