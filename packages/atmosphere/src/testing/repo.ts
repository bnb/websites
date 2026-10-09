// A reader's repo in memory, behind a session's fetchHandler, for tests of
// anything that writes to it: createRecord, deleteRecord and listRecords
// answer as a PDS would, a page of `pageSize` records at a time.
import { vi } from 'vitest';
import type { Session } from '../repo';

interface Stored {
	rkey: string;
	value: Record<string, unknown>;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

export function fakeRepo({
	did = 'did:plc:reader',
	records = {},
	pageSize = 100
}: {
	did?: string;
	/** what's in it to begin with, by collection */
	records?: Record<string, Stored[]>;
	pageSize?: number;
} = {}) {
	let next = 0;
	let held: Promise<void> | undefined;
	const repo = {
		did,
		records: Object.fromEntries(
			Object.entries(records).map(([collection, list]) => [collection, [...list]])
		),
		/** each XRPC call the session made, as [method, nsid, body or query] */
		calls: [] as Array<[string, string, Record<string, unknown>]>,
		/** a Response to fail a call with, or null to answer it */
		fail: (_nsid: string): Response | null => null,
		/** keeps writes waiting until the returned function is called */
		hold() {
			let release!: () => void;
			held = new Promise((resolve) => (release = resolve));
			return () => {
				held = undefined;
				release();
			};
		},
		session: undefined as unknown as Session & { fetchHandler: ReturnType<typeof vi.fn> }
	};
	const fetchHandler = vi.fn(async (pathname: string, init: RequestInit = {}) => {
		const url = new URL(pathname, 'https://pds.example');
		const nsid = url.pathname.replace('/xrpc/', '');
		const body = init.body
			? (JSON.parse(String(init.body)) as Record<string, unknown>)
			: Object.fromEntries(url.searchParams);
		repo.calls.push([init.method ?? 'GET', nsid, body]);
		if (init.method === 'POST') await held;
		const failure = repo.fail(nsid);
		if (failure) return failure;
		const collection = String(body.collection);
		const list = (repo.records[collection] ??= []);
		if (nsid === 'com.atproto.repo.createRecord') {
			const rkey = `3knew${next++}`;
			list.unshift({ rkey, value: body.record as Record<string, unknown> });
			return json({ uri: `at://${did}/${collection}/${rkey}`, cid: `cid-${rkey}` });
		}
		if (nsid === 'com.atproto.repo.deleteRecord') {
			repo.records[collection] = list.filter((record) => record.rkey !== body.rkey);
			return json({});
		}
		if (nsid === 'com.atproto.repo.listRecords') {
			const start = Number(body.cursor ?? 0);
			const page = list.slice(start, start + pageSize).map(({ rkey, value }) => ({
				uri: `at://${did}/${collection}/${rkey}`,
				cid: `cid-${rkey}`,
				value
			}));
			return json({ records: page, cursor: String(start + pageSize) });
		}
		return json({ error: 'MethodNotImplemented' }, 501);
	});
	repo.session = { did, fetchHandler };
	return repo;
}
