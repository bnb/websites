// Writing to and reading from the signed-in reader's own repo, through their
// OAuth session (which knows their PDS and signs each request).
import { AtmosphereError, errorMessage, isObject, sessionFailed } from './errors';
import type { RepoRecord } from './slingshot';

/** What these need from a session: an OAuthSession from ./oauth, or a stand-in in tests. */
export interface Session {
	did: string;
	fetchHandler(pathname: string, init?: RequestInit): Promise<Response>;
}

/** A safety stop on listing: 100 pages of 100 records. */
const MAX_PAGES = 100;

async function xrpc(
	session: Session,
	nsid: string,
	{ params, body }: { params?: URLSearchParams; body?: unknown }
): Promise<unknown> {
	const pathname = `/xrpc/${nsid}${params ? `?${params}` : ''}`;
	const init: RequestInit =
		body === undefined
			? { method: 'GET' }
			: {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				};
	let response: Response;
	try {
		response = await session.fetchHandler(pathname, init);
	} catch (error) {
		throw sessionFailed(nsid, error);
	}
	const data: unknown = await response.json().catch(() => undefined);
	if (!response.ok) {
		throw new AtmosphereError(
			'http',
			errorMessage(data) ?? `${nsid} failed with ${response.status}`,
			response.status
		);
	}
	return data;
}

/**
 * Writes a record to the reader's repo; `$type` is the collection. The new
 * record's URI and CID, or null if their PDS didn't say.
 */
export async function createRecord(
	session: Session,
	collection: string,
	record: Record<string, unknown>
): Promise<{ uri: string; cid: string } | null> {
	const data = await xrpc(session, 'com.atproto.repo.createRecord', {
		body: { repo: session.did, collection, record: { $type: collection, ...record } }
	});
	return isObject(data) && typeof data.uri === 'string' && typeof data.cid === 'string'
		? { uri: data.uri, cid: data.cid }
		: null;
}

export async function deleteRecord(session: Session, collection: string, rkey: string) {
	await xrpc(session, 'com.atproto.repo.deleteRecord', {
		body: { repo: session.did, collection, rkey }
	});
}

/** Every record the reader has in a collection, newest first, with each one's rkey. */
export async function listRecords<T = unknown>(
	session: Session,
	collection: string
): Promise<Array<RepoRecord<T> & { rkey: string }>> {
	const records: Array<RepoRecord<T> & { rkey: string }> = [];
	let cursor: string | undefined;
	for (let page = 0; page < MAX_PAGES; page++) {
		const params = new URLSearchParams({ repo: session.did, collection, limit: '100' });
		if (cursor) params.set('cursor', cursor);
		const data = await xrpc(session, 'com.atproto.repo.listRecords', { params });
		if (!isObject(data) || !Array.isArray(data.records)) {
			throw new AtmosphereError('invalid', 'com.atproto.repo.listRecords sent no records');
		}
		const list = data.records as Array<RepoRecord<T>>;
		for (const record of list) records.push({ ...record, rkey: record.uri.split('/').pop()! });
		if (!list.length || typeof data.cursor !== 'string') break;
		cursor = data.cursor;
	}
	return records;
}
