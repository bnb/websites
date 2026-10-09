// Slingshot, microcosm's cache of records and identities: any account's record
// and its handle and PDS, from one host, so a page never has to find and call
// each author's PDS itself. It answers any origin.
import { isObject } from './errors';
import { getJson, invalid, type ReadOptions } from './http';

export const SLINGSHOT = 'https://slingshot.microcosm.blue';

export interface RecordRef {
	/** the account's DID (or handle) */
	repo: string;
	collection: string;
	rkey: string;
}

/** A record as a repo hands it out. `value` is whatever its author wrote, so check it before trusting it. */
export interface RepoRecord<T> {
	uri: string;
	cid: string;
	value: T;
}

/** An account's identity, as Slingshot's mini DID document gives it. */
export interface Identity {
	did: string;
	handle: string;
	pds: string;
}

const xrpcUrl = (nsid: string, params: Record<string, string>) => {
	const url = new URL(`/xrpc/${nsid}`, SLINGSHOT);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	return url;
};

/** One record from anyone's repo. A missing record is an `http` error (RecordNotFound). */
export async function getRecord<T = unknown>(
	{ repo, collection, rkey }: RecordRef,
	options?: ReadOptions
): Promise<RepoRecord<T>> {
	const url = xrpcUrl('com.atproto.repo.getRecord', { repo, collection, rkey });
	const body = await getJson(url, options);
	if (!isObject(body) || typeof body.uri !== 'string' || typeof body.cid !== 'string') {
		throw invalid(url);
	}
	return { uri: body.uri, cid: body.cid, value: body.value as T };
}

/** A DID or handle's identity: its DID, handle and PDS. */
export async function resolveIdentity(
	identifier: string,
	options?: ReadOptions
): Promise<Identity> {
	const url = xrpcUrl('blue.microcosm.identity.resolveMiniDoc', { identifier });
	const body = await getJson(url, options);
	if (
		!isObject(body) ||
		typeof body.did !== 'string' ||
		typeof body.handle !== 'string' ||
		typeof body.pds !== 'string'
	) {
		throw invalid(url);
	}
	return { did: body.did, handle: body.handle, pds: body.pds };
}
