// Helpers for the browser tests of the subscribe button.
import type { OAuthSession } from '@atproto/oauth-client-browser';
import { expect, vi } from 'vitest';
import { json } from './fetch';

export const READER = 'did:plc:reader';
export const READER_PDS = 'https://reader-pds.example';

interface Subscription {
	rkey: string;
	publication: string;
}

/**
 * A reader's PDS behind a stubbed fetch, holding their subscription records
 * (one per page, to walk the cursor), and a signed-in OAuth session that
 * writes to it.
 */
export function fakeReader({
	did = READER,
	subscriptions = []
}: { did?: string; subscriptions?: Subscription[] } = {}) {
	const reader = {
		did,
		subscriptions: [...subscriptions],
		/** each XRPC call the session made, as [pathname, body] */
		calls: [] as Array<[string, Record<string, unknown>]>,
		/** a Response to fail a request with, or null to answer it */
		fail: (_url: URL): Response | null => null,
		session: undefined as unknown as OAuthSession
	};
	const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
		const url = new URL(String(input));
		expect(init.signal, `no signal on ${url}`).toBeInstanceOf(AbortSignal);
		const failure = reader.fail(url);
		if (failure) return failure;
		const didDocument = did.startsWith('did:web:')
			? `https://${decodeURIComponent(did.slice(8))}/.well-known/did.json`
			: `https://plc.directory/${did}`;
		if (url.href === didDocument) {
			return json({ service: [{ id: `${did}#atproto_pds`, serviceEndpoint: READER_PDS }] });
		}
		if (url.href.startsWith(`${READER_PDS}/xrpc/com.atproto.repo.listRecords?`)) {
			expect(url.searchParams.get('repo')).toBe(did);
			expect(url.searchParams.get('collection')).toBe('site.standard.graph.subscription');
			const index = Number(url.searchParams.get('cursor') || 0);
			const records = reader.subscriptions.slice(index, index + 1).map(({ rkey, publication }) => ({
				uri: `at://${did}/site.standard.graph.subscription/${rkey}`,
				value: { publication }
			}));
			return json({ records, cursor: String(index + 1) });
		}
		throw new Error(`unexpected fetch ${url}`);
	});
	const fetchHandler = vi.fn(async (pathname: string, init: RequestInit) => {
		const body = JSON.parse(String(init.body)) as Record<string, unknown>;
		reader.calls.push([pathname, body]);
		if (pathname.endsWith('createRecord')) {
			const record = body.record as { publication: string };
			reader.subscriptions.push({ rkey: '3knew', publication: record.publication });
		} else if (pathname.endsWith('deleteRecord')) {
			reader.subscriptions = reader.subscriptions.filter((sub) => sub.rkey !== body.rkey);
		}
		return json({});
	});
	reader.session = { did, fetchHandler } as unknown as OAuthSession;
	return Object.assign(reader, { fetch, fetchHandler });
}
