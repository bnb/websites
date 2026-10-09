// Reading a post's comments. What replies to what comes from Constellation,
// each comment from Slingshot, and each author's handle too, cached for the
// page view. Replies are found by asking what links to a comment already shown,
// so a reply can only ever appear under a comment that belongs to the post.
import { getRecord, listLinks, resolveIdentity, type LinkingRecord } from '@bnb/atmosphere';
import { COMMENT } from '../constants';

export interface Comment {
	uri: string;
	did: string;
	/** null when it can't be resolved */
	handle: string | null;
	text: string;
	createdAt: string;
}

export interface CommentPage {
	/** oldest first */
	comments: Comment[];
	/** for the page before these (Constellation lists newest first); null when there's none */
	cursor: string | null;
}

/** what's on a comment record; its author wrote it, so every field is checked */
interface CommentRecord {
	subject?: unknown;
	text?: unknown;
	createdAt?: unknown;
	labels?: { values?: unknown };
}

/** how many records load at once */
const CONCURRENCY = 4;

const handles = new Map<string, Promise<string | null>>();

/** An account's handle, looked up once per page view. */
export function handleOf(did: string): Promise<string | null> {
	let handle = handles.get(did);
	if (!handle) {
		handle = resolveIdentity(did).then(
			(identity) => identity.handle,
			() => null
		);
		handles.set(did, handle);
	}
	return handle;
}

async function mapLimit<T, R>(items: T[], limit: number, map: (item: T) => Promise<R>) {
	const results: R[] = Array.from({ length: items.length });
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await map(items[index]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

const uriOf = ({ did, collection, rkey }: LinkingRecord) => `at://${did}/${collection}/${rkey}`;

/**
 * A page of the comments on `subject` (the post, or a comment), oldest first.
 * Left out: authors and comments in `hide`, comments that won't load or don't
 * point at `subject`, and any comment its author labelled (nudity, gore,
 * !no-unauthenticated or anything else). Throws if Constellation can't list them.
 */
export async function loadComments(
	subject: string,
	{ hide, limit, cursor }: { hide: ReadonlySet<string>; limit: number; cursor?: string }
): Promise<CommentPage> {
	const page = await listLinks({
		target: subject,
		collection: COMMENT,
		path: '.subject',
		limit,
		cursor
	});
	const shown = page.records.filter((link) => !hide.has(link.did) && !hide.has(uriOf(link)));
	const loaded = await mapLimit(shown, CONCURRENCY, async (link): Promise<Comment | null> => {
		const record = await getRecord<CommentRecord>({
			repo: link.did,
			collection: COMMENT,
			rkey: link.rkey
		}).catch(() => null);
		const value = record?.value;
		const labelled = Array.isArray(value?.labels?.values) && value.labels.values.length > 0;
		if (
			!value ||
			labelled ||
			value.subject !== subject ||
			typeof value.text !== 'string' ||
			!value.text.trim() ||
			typeof value.createdAt !== 'string' ||
			Number.isNaN(Date.parse(value.createdAt))
		) {
			return null;
		}
		return {
			uri: uriOf(link),
			did: link.did,
			handle: await handleOf(link.did),
			text: value.text,
			createdAt: value.createdAt
		};
	});
	const comments = loaded
		.filter((comment) => comment !== null)
		.toSorted((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
	return { comments, cursor: page.cursor };
}

/** Runs at most `max` tasks at once; the rest wait their turn. */
export function limiter(max: number) {
	let active = 0;
	const waiting: Array<() => void> = [];
	return async <T>(task: () => Promise<T>): Promise<T> => {
		if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
		active++;
		try {
			return await task();
		} finally {
			active--;
			waiting.shift()?.();
		}
	};
}
