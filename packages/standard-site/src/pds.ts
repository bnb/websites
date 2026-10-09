// The handful of XRPC calls publishing needs, on plain fetch, so it doesn't
// pull in the whole @atproto/api dependency tree.
import { setTimeout as sleep } from 'node:timers/promises';

/** Every request gets this long before it's given up on, so a hung server fails the publish. */
export const TIMEOUT = 30_000;
// a rate-limited request is retried, as long as the wait it asks for is short
// enough to sit through
const RETRIES = 3;
const MAX_RETRY_WAIT = 60_000;

const DIGITS = /^\d+$/;
const TRAILING_SLASH = /\/$/;

export interface AtpRecord<T = Record<string, unknown>> {
	uri: string;
	cid: string;
	value: T;
}

export interface BlobRef {
	$type: 'blob';
	ref: { $link: string };
	mimeType: string;
	size: number;
}

export class XrpcError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code?: string
	) {
		super(message);
	}
}

/** The PDS in a DID document (did:plc or did:web). */
export async function resolvePds(did: string): Promise<string> {
	let url: string;
	if (did.startsWith('did:plc:')) {
		url = `https://plc.directory/${did}`;
	} else if (did.startsWith('did:web:')) {
		url = `https://${decodeURIComponent(did.slice('did:web:'.length))}/.well-known/did.json`;
	} else {
		throw new Error(`Unsupported DID method: ${did}`);
	}
	const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
	if (!response.ok) throw new Error(`Resolving ${did} failed: ${response.status}`);
	const doc = (await response.json()) as {
		service?: Array<{ id: string; serviceEndpoint: string }>;
	};
	const service = (doc.service || []).find(
		(entry) => entry.id === '#atproto_pds' || entry.id === `${did}#atproto_pds`
	);
	if (!service) throw new Error(`${did} has no PDS in its DID document`);
	return service.serviceEndpoint.replace(TRAILING_SLASH, '');
}

// how long a rate-limited response asks to wait before trying again, in ms
function retryAfter(response: Response): number {
	const seconds = response.headers.get('retry-after');
	if (seconds && DIGITS.test(seconds)) return Number(seconds) * 1000;
	// the PDS's own rate limit headers give the time the limit resets
	const reset = response.headers.get('ratelimit-reset');
	if (reset && DIGITS.test(reset)) return Math.max(0, Number(reset) * 1000 - Date.now());
	return 1000;
}

interface RequestOptions {
	params?: Record<string, string | number | undefined>;
	body?: unknown;
	headers?: Record<string, string>;
}

export class Pds {
	accessJwt: string | null = null;

	constructor(readonly service: string) {}

	static async forDid(did: string): Promise<Pds> {
		return new Pds(await resolvePds(did));
	}

	async request<T = Record<string, unknown>>(
		method: 'GET' | 'POST',
		nsid: string,
		{ params, body, headers = {} }: RequestOptions = {}
	): Promise<T> {
		const url = new URL(`/xrpc/${nsid}`, this.service);
		for (const [key, value] of Object.entries(params || {})) {
			if (value !== undefined) url.searchParams.set(key, String(value));
		}
		if (this.accessJwt) headers.authorization = `Bearer ${this.accessJwt}`;
		let payload: BodyInit | undefined;
		if (Buffer.isBuffer(body)) {
			payload = new Uint8Array(body);
		} else if (body !== undefined) {
			headers['content-type'] = 'application/json';
			payload = JSON.stringify(body);
		}
		let response: Response;
		for (let attempt = 0; ; attempt++) {
			const init: RequestInit = { method, headers, signal: AbortSignal.timeout(TIMEOUT) };
			if (method === 'POST') init.body = payload;
			response = await fetch(url, init);
			const wait = response.status === 429 ? retryAfter(response) : false;
			if (attempt === RETRIES || wait === false || wait > MAX_RETRY_WAIT) break;
			await response.body?.cancel();
			await sleep(wait);
		}
		const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
		if (!response.ok) {
			throw new XrpcError(
				`${nsid} failed: ${response.status} ${data.error || ''} ${data.message || ''}`.trim(),
				response.status,
				data.error
			);
		}
		return data as T;
	}

	async login(identifier: string, password: string): Promise<{ did: string; accessJwt: string }> {
		const session = await this.request<{ did: string; accessJwt: string }>(
			'POST',
			'com.atproto.server.createSession',
			{ body: { identifier, password } }
		);
		this.accessJwt = session.accessJwt;
		return session;
	}

	async getRecord(repo: string, collection: string, rkey: string): Promise<AtpRecord | null> {
		try {
			return await this.request<AtpRecord>('GET', 'com.atproto.repo.getRecord', {
				params: { repo, collection, rkey }
			});
		} catch (error) {
			if (error instanceof XrpcError && error.code === 'RecordNotFound') return null;
			throw error;
		}
	}

	async listRecords(repo: string, collection: string): Promise<AtpRecord[]> {
		const records: AtpRecord[] = [];
		let cursor: string | undefined;
		do {
			const page = await this.request<{ records: AtpRecord[]; cursor?: string }>(
				'GET',
				'com.atproto.repo.listRecords',
				{ params: { repo, collection, limit: 100, cursor } }
			);
			records.push(...page.records);
			cursor = page.records.length ? page.cursor : undefined;
		} while (cursor);
		return records;
	}

	putRecord(repo: string, collection: string, rkey: string, record: Record<string, unknown>) {
		return this.request('POST', 'com.atproto.repo.putRecord', {
			body: { repo, collection, rkey, record }
		});
	}

	deleteRecord(repo: string, collection: string, rkey: string) {
		return this.request('POST', 'com.atproto.repo.deleteRecord', {
			body: { repo, collection, rkey }
		});
	}

	async uploadBlob(bytes: Buffer, mimeType: string): Promise<BlobRef> {
		const { blob } = await this.request<{ blob: BlobRef }>('POST', 'com.atproto.repo.uploadBlob', {
			body: bytes,
			headers: { 'content-type': mimeType }
		});
		return blob;
	}
}
