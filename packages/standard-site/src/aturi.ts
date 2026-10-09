const DID = /^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/;
const NSID = /^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+)+$/;
const RKEY = /^(?!\.\.?$)[a-zA-Z0-9._:~-]{1,512}$/;
const AT_URI = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/;

export const isDid = (value: unknown): value is string =>
	typeof value === 'string' && value.length <= 2048 && DID.test(value);

export interface AtUri {
	did: string;
	collection: string;
	rkey: string;
}

/**
 * at://did/collection/rkey → { did, collection, rkey }. Only DID authorities,
 * since a handle in a record's URI can change hands.
 */
export function parseAtUri(uri: string | undefined): AtUri {
	const match = AT_URI.exec(uri || '');
	if (!match || !isDid(match[1]) || !NSID.test(match[2]) || !RKEY.test(match[3])) {
		throw new Error(`Not an at:// record URI: ${uri}`);
	}
	return { did: match[1], collection: match[2], rkey: match[3] };
}
