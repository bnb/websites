// Constellation, microcosm's backlink index of the whole network: who links to
// a record (likes, upvotes, comments), without visiting anyone's repo. It
// answers any origin (access-control-allow-origin: *).
import { isObject } from './errors';
import { getJson, invalid, type ReadOptions } from './http';

export const CONSTELLATION = 'https://constellation.microcosm.blue';

/** Records of `collection` whose field at `path` (like `.subject`) points at `target`. */
export interface LinkQuery {
	/** what's linked to: an at:// URI, a DID or a URL */
	target: string;
	collection: string;
	path: string;
}

/** A record that links to the target, by where it lives. */
export interface LinkingRecord {
	did: string;
	collection: string;
	rkey: string;
}

export interface LinkPage {
	/** every matching link, across all pages */
	total: number;
	records: LinkingRecord[];
	/** for the next page; null on the last */
	cursor: string | null;
}

function linksUrl(endpoint: string, { target, collection, path }: LinkQuery) {
	const url = new URL(endpoint, CONSTELLATION);
	url.searchParams.set('target', target);
	url.searchParams.set('collection', collection);
	url.searchParams.set('path', path);
	return url;
}

const isLinkingRecord = (value: unknown): value is LinkingRecord =>
	isObject(value) &&
	typeof value.did === 'string' &&
	typeof value.collection === 'string' &&
	typeof value.rkey === 'string';

/** How many records link to the target, like the number of likes on a post. */
export async function countLinks(query: LinkQuery, options?: ReadOptions): Promise<number> {
	const url = linksUrl('/links/count', query);
	const body = await getJson(url, options);
	if (!isObject(body) || typeof body.total !== 'number') throw invalid(url);
	return body.total;
}

/**
 * One page of the records linking to the target, newest first. `did` narrows
 * them to one account's (has this reader liked it?).
 */
export async function listLinks(
	query: LinkQuery & { did?: string; limit?: number; cursor?: string },
	options?: ReadOptions
): Promise<LinkPage> {
	const url = linksUrl('/links', query);
	if (query.did) url.searchParams.set('did', query.did);
	if (query.limit) url.searchParams.set('limit', String(query.limit));
	if (query.cursor) url.searchParams.set('cursor', query.cursor);
	const body = await getJson(url, options);
	if (
		!isObject(body) ||
		typeof body.total !== 'number' ||
		!Array.isArray(body.linking_records) ||
		!body.linking_records.every(isLinkingRecord)
	) {
		throw invalid(url);
	}
	return {
		total: body.total,
		records: body.linking_records,
		cursor: typeof body.cursor === 'string' ? body.cursor : null
	};
}
