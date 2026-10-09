// AT Tags (https://tangled.org/chrisshank.com/at-tags/): <meta> tags that map a
// web page back to the AT Protocol records and accounts behind it.
import { DID } from './account';

export interface AtTag {
	name: `at:${string}`;
	content: string;
}

/** The account behind the sites, as an AT URI, for `at:me` and `at:author`. */
export const ACCOUNT_URI = `at://${DID}`;

/** A record's AT URI in the account's repo. */
export const recordUri = (collection: string, rkey: string, did = DID): string =>
	`at://${did}/${collection}/${rkey}`;

/**
 * The tags for a page, one per AT URI: `me` (the site's account), `canonical`
 * (records the page can't exist without), `alternate` (records it shows) and
 * `author` (who wrote it). Each property can repeat.
 */
export function atTags({
	me = [],
	canonical = [],
	alternate = [],
	author = []
}: {
	me?: string[];
	canonical?: string[];
	alternate?: string[];
	author?: string[];
}): AtTag[] {
	return Object.entries({ me, canonical, alternate, author }).flatMap(([property, uris]) =>
		uris.map((content) => ({ name: `at:${property}` as const, content }))
	);
}
