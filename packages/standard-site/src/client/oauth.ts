// The heavy half of the site's scripts, only loaded once a reader writes:
// signs them in with ATProto OAuth (@bnb/atmosphere) and writes or deletes
// their subscriptions, upvotes and comments from the browser.
import {
	createRecord,
	deleteRecord,
	listRecords,
	oauthClient,
	type OAuthClient,
	type Session
} from '@bnb/atmosphere/oauth';
import { COMMENT, SCOPE, SUBSCRIPTION, UPVOTE } from '../constants';
import type { ClientConfig, Pending } from './shared';

type FindSubscriptions = (did: string, publication: string) => Promise<string[]>;

export interface CallbackState {
	action?: 'subscribe' | 'unsubscribe';
	publication?: string;
	/** an upvote or comment, finished on the page the reader goes back to */
	pending?: Pending;
	returnTo?: string;
}

// made on the first click, then kept
let client: OAuthClient | undefined;
const getClient = (config: ClientConfig) => (client ??= oauthClient({ ...config, scope: SCOPE }));

export async function subscribe(
	session: Session,
	publication: string,
	findSubscriptions: FindSubscriptions
) {
	// don't stack up duplicates if they subscribed from another tab or device
	if ((await findSubscriptions(session.did, publication)).length) return;
	await createRecord(session, SUBSCRIPTION, { publication, createdAt: new Date().toISOString() });
}

// every matching record goes, so duplicates (two tabs subscribing at once)
// can't leave the reader still subscribed
export async function unsubscribe(
	session: Session,
	publication: string,
	findSubscriptions: FindSubscriptions
) {
	for (const rkey of await findSubscriptions(session.did, publication)) {
		await deleteRecord(session, SUBSCRIPTION, rkey);
	}
}

/** A session saved from an earlier sign-in, or null if it's gone or expired. */
export const restore = (config: ClientConfig, did: string) => getClient(config).restore(did);

/** Leaves the page for the reader's authorization server; `state` comes back to the callback page. */
export const signIn = (config: ClientConfig, input: string, state: CallbackState) =>
	getClient(config).signIn(input, state);

/**
 * Finishes signing in. A reader who backed out at the authorization server
 * comes back as `cancelled`, with their state, so they can be sent back.
 */
export const callback = (config: ClientConfig) => getClient(config).callback<CallbackState>();

/** Forgets the reader's session here and revokes it. */
export const signOut = (config: ClientConfig, did: string) => getClient(config).signOut(did);

/** The rkeys of the reader's upvotes of `subject` (usually one), read fresh from their repo. */
async function upvotesOf(session: Session, subject: string): Promise<string[]> {
	const records = await listRecords<{ subject?: unknown }>(session, UPVOTE);
	return records.filter((record) => record.value.subject === subject).map(({ rkey }) => rkey);
}

/**
 * Upvotes `subject`, unless they already have (from another tab or app), or
 * takes back every upvote they've given it.
 */
export async function upvote(session: Session, subject: string, on: boolean) {
	const rkeys = await upvotesOf(session, subject);
	if (on) {
		if (!rkeys.length) {
			await createRecord(session, UPVOTE, { subject, createdAt: new Date().toISOString() });
		}
		return;
	}
	for (const rkey of rkeys) await deleteRecord(session, UPVOTE, rkey);
}

/** Writes a comment; a reply's subject is the comment it answers, and its root the document. */
export const comment = (
	session: Session,
	{ subject, rootSubject, text }: { subject: string; rootSubject?: string; text: string }
) =>
	createRecord(session, COMMENT, {
		subject,
		text,
		createdAt: new Date().toISOString(),
		...(rootSubject && { rootSubject })
	});

/** Deletes one of the reader's own comments. */
export async function deleteComment(session: Session, uri: string) {
	const own = `at://${session.did}/${COMMENT}/`;
	if (!uri.startsWith(own)) throw new Error("That comment isn't yours to delete.");
	await deleteRecord(session, COMMENT, uri.slice(own.length));
}
