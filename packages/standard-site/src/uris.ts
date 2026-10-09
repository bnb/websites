import { parseAtUri } from './aturi';
import { DOCUMENT } from './constants';
import { deterministicTid } from './tid';

export interface Dated {
	/** stable and unique: a slug */
	key: string;
	/** sorts posts the way their URIs are handed out (a file path, say) */
	order: string;
	date: Date;
	/** the record URI pinned in front matter, if it's been published */
	atUri?: string;
}

export interface DocumentUri {
	uri: string;
	/** whether the post already holds it */
	pinned: boolean;
}

/**
 * Each post's record URI: its pinned `atUri`, or one derived from its date and
 * key that no other post uses. Pinned URIs have to be documents in `did`.
 */
export function documentUris(posts: readonly Dated[], did: string): Map<string, DocumentUri> {
	const sorted = posts.toSorted((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
	const used = new Set<string>();
	for (const post of sorted) {
		if (!post.atUri) continue;
		const uri = parseAtUri(post.atUri);
		if (uri.did !== did || uri.collection !== DOCUMENT) {
			throw new Error(`${post.order} has atUri ${post.atUri}, which isn't a ${DOCUMENT} in ${did}`);
		}
		used.add(uri.rkey);
	}

	const uris = new Map<string, DocumentUri>();
	for (const post of sorted) {
		if (post.atUri) {
			uris.set(post.key, { uri: post.atUri, pinned: true });
			continue;
		}
		let rkey: string;
		let bump = 0;
		do rkey = deterministicTid(post.date, post.key, bump++);
		while (used.has(rkey));
		used.add(rkey);
		uris.set(post.key, { uri: `at://${did}/${DOCUMENT}/${rkey}`, pinned: false });
	}
	return uris;
}
