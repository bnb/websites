import { log } from 'evlog';
import { DEFAULT_PDS, DID } from './account';
import type { AtpRecord } from './types';

type FetchLike = typeof fetch;

const PLC_DIRECTORY = 'https://plc.directory';

/** A safety stop on pagination: 20 pages of 100 records per collection. */
export const MAX_PAGES = 20;

const PAGE_SIZE = 100;

/** Resolve an account's current PDS from its DID document (migration-safe). */
export async function resolvePds(
	fetchFn: FetchLike,
	{ did = DID, fallback = DEFAULT_PDS }: { did?: string; fallback?: string } = {}
): Promise<string> {
	try {
		const res = await fetchFn(`${PLC_DIRECTORY}/${did}`);
		if (!res.ok) return fallback;
		const doc = (await res.json()) as {
			service?: Array<{ type: string; serviceEndpoint: string }>;
		};
		const svc = doc.service?.find((s) => s.type === 'AtprotoPersonalDataServer');
		return svc?.serviceEndpoint ?? fallback;
	} catch {
		return fallback;
	}
}

/** One page of com.atproto.repo.listRecords, which lists the newest record key first. */
async function listPage<T>(
	fetchFn: FetchLike,
	pds: string,
	did: string,
	collection: string,
	limit: number,
	cursor?: string
): Promise<{ records: AtpRecord<T>[]; cursor?: string }> {
	const url = new URL(`${pds}/xrpc/com.atproto.repo.listRecords`);
	url.searchParams.set('repo', did);
	url.searchParams.set('collection', collection);
	url.searchParams.set('limit', String(limit));
	if (cursor) url.searchParams.set('cursor', cursor);

	const res = await fetchFn(url);
	if (!res.ok) throw new Error(`listRecords ${collection} → ${res.status}`);
	const data = (await res.json()) as { records?: AtpRecord<T>[]; cursor?: string };
	return { records: data.records ?? [], cursor: data.cursor };
}

/** List every record in a collection, following pagination (up to MAX_PAGES). */
export async function listRecords<T>(
	fetchFn: FetchLike,
	pds: string,
	collection: string,
	{ did = DID }: { did?: string } = {}
): Promise<AtpRecord<T>[]> {
	const out: AtpRecord<T>[] = [];
	let cursor: string | undefined;

	for (let page = 0; page < MAX_PAGES; page++) {
		const data = await listPage<T>(fetchFn, pds, did, collection, PAGE_SIZE, cursor);
		out.push(...data.records);
		if (!data.cursor || data.records.length < PAGE_SIZE) return out;
		cursor = data.cursor;
	}

	log.warn({ atproto: { listRecords: { collection, records: out.length, truncated: true } } });
	return out;
}

/**
 * The record with the highest key in a collection, in one request, or null if
 * it's empty. Record keys are usually TIDs (timestamps), so that's the newest.
 */
export async function latestRecord<T>(
	fetchFn: FetchLike,
	pds: string,
	collection: string,
	{ did = DID }: { did?: string } = {}
): Promise<AtpRecord<T> | null> {
	const { records } = await listPage<T>(fetchFn, pds, did, collection, 1);
	return records[0] ?? null;
}

/** One record's value, or null if it's missing or the read fails. */
export async function getRecord<T>(
	fetchFn: FetchLike,
	pds: string,
	collection: string,
	rkey: string,
	{ did = DID }: { did?: string } = {}
): Promise<T | null> {
	try {
		const url = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
		url.searchParams.set('repo', did);
		url.searchParams.set('collection', collection);
		url.searchParams.set('rkey', rkey);

		const res = await fetchFn(url);
		if (!res.ok) return null;
		const data = (await res.json()) as { value?: T };
		return data.value ?? null;
	} catch {
		return null;
	}
}
