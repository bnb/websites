// standard.site for bnb.im: posts are published to the AT Protocol as
// site.standard.document records (see publish.ts), each page links its record,
// and readers can subscribe from any Atmosphere account. The work is
// @bnb/standard-site's; this is the site's publication and its posts' URIs.
import {
	callbackPage as page,
	clientMetadata as metadata,
	documentUris as uris,
	headTags as tags,
	type DocumentUri,
	type HeadTag,
	type Site
} from '@bnb/standard-site';
import { SITE_URL } from '../site';
import type { Post } from './posts';

export { DISCUSSION_PATH, DOCUMENT, SCRIPT_PATH, deterministicTid } from '@bnb/standard-site';

export const DID = 'did:plc:uashgn65n5z7aqwk5cbuba5c';

export const PUBLICATION = {
	uri: `at://${DID}/site.standard.publication/3mtxb2uyta22l`,
	name: 'Tierney Cyren',
	description: 'On Open Source, JavaScript, Software, Standards, and real life.',
	showInDiscover: true
};

export const SITE: Site = { url: SITE_URL, publication: PUBLICATION };

/**
 * Each post's record URI: its pinned `atUri`, or one derived from its date and
 * slug that no other post uses. Drafts have none.
 */
export function documentUris(posts: readonly Post[]): Map<string, DocumentUri> {
	return uris(
		posts
			.filter((post) => !post.draft)
			.map((post) => ({ key: post.slug, order: post.file, date: post.date, atUri: post.atUri })),
		DID
	);
}

/** AT Tags on every page; on a post, also the tags that link its record. */
export const headTags = (documentUri?: string): HeadTag[] => tags(PUBLICATION.uri, documentUri);

/** /oauth-client-metadata.json */
export const clientMetadata = () => metadata(SITE);

/** /oauth/callback/ */
export const callbackPage = () => page(SITE);
