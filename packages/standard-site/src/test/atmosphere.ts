// Constellation and Slingshot behind a stubbed fetch, for the tests of the
// upvote button and the comments: upvotes and comments on documents, and the
// handles of the people who wrote them. Nothing touches the network.
import { onTestFinished, vi } from 'vitest';

export interface FakeComment {
	did: string;
	rkey: string;
	/** the document, or the comment it replies to */
	subject: string;
	text: string;
	createdAt: string;
	/** self labels */
	labels?: string[];
	/** gone from its repo, though Constellation still lists it */
	deleted?: boolean;
	/** where Constellation lists it, when that isn't its subject (a stale or wrong index) */
	listedUnder?: string;
}

export const commentUri = ({ did, rkey }: Pick<FakeComment, 'did' | 'rkey'>) =>
	`at://${did}/at.upvote.comment/${rkey}`;

const json = (body: unknown, status = 200) => Response.json(body, { status });

export function fakeAtmosphere({
	upvotes = [],
	comments = [],
	handles = {}
}: {
	/** who has upvoted which document */
	upvotes?: Array<{ did: string; subject: string }>;
	comments?: FakeComment[];
	handles?: Record<string, string>;
} = {}) {
	const world = {
		upvotes: [...upvotes],
		comments: [...comments],
		handles: { ...handles },
		/** a Response to fail a request with, or null to answer it */
		fail: (_url: URL): Response | null => null,
		/** requests matching `match` wait until the returned function is called */
		hold(match: (url: URL) => boolean) {
			let release!: () => void;
			const gate = new Promise<void>((resolve) => (release = resolve));
			holds.push({ match, gate });
			return release;
		},
		requests: [] as URL[]
	};
	const holds: Array<{ match: (url: URL) => boolean; gate: Promise<void> }> = [];

	const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
		const url = new URL(String(input));
		world.requests.push(url);
		for (const { match, gate } of holds) if (match(url)) await gate;
		const failure = world.fail(url);
		if (failure) return failure;
		const param = (name: string) => url.searchParams.get(name) ?? '';

		if (url.origin === 'https://constellation.microcosm.blue') {
			const target = param('target');
			if (url.pathname === '/links/count') {
				return json({ total: world.upvotes.filter((upvote) => upvote.subject === target).length });
			}
			const links =
				param('collection') === 'at.upvote.signal'
					? world.upvotes
							.filter((upvote) => upvote.subject === target)
							.map(({ did }, n) => ({ did, collection: 'at.upvote.signal', rkey: `3kup${n}` }))
					: world.comments
							.filter((comment) => (comment.listedUnder ?? comment.subject) === target)
							.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
							.map(({ did, rkey }) => ({ did, collection: 'at.upvote.comment', rkey }));
			const mine = param('did') ? links.filter((link) => link.did === param('did')) : links;
			const start = Number(param('cursor') || 0);
			const limit = Number(param('limit') || 16);
			return json({
				total: mine.length,
				linking_records: mine.slice(start, start + limit),
				cursor: start + limit < mine.length ? String(start + limit) : null
			});
		}

		if (url.pathname === '/xrpc/com.atproto.repo.getRecord') {
			const comment = world.comments.find(
				({ did, rkey, deleted }) => !deleted && did === param('repo') && rkey === param('rkey')
			);
			if (!comment)
				return json({ error: 'RecordNotFound', message: 'Could not locate record' }, 400);
			const { subject, text, createdAt, labels } = comment;
			return json({
				uri: commentUri(comment),
				cid: `cid-${comment.rkey}`,
				value: {
					$type: 'at.upvote.comment',
					subject,
					text,
					createdAt,
					...(labels && {
						labels: {
							$type: 'com.atproto.label.defs#selfLabels',
							values: labels.map((val) => ({ val }))
						}
					})
				}
			});
		}

		if (url.pathname === '/xrpc/blue.microcosm.identity.resolveMiniDoc') {
			const did = param('identifier');
			const handle = world.handles[did];
			if (!handle) return json({ error: 'InvalidRequest', message: 'Could not resolve' }, 400);
			return json({ did, handle, pds: 'https://pds.example' });
		}

		throw new Error(`unexpected fetch ${url}`);
	});
	onTestFinished(() => fetch.mockRestore());
	return world;
}
