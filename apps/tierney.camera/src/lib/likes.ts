// Liking photographs, from the reader's side. A like is grain.social's own: a
// social.grain.favorite record in the reader's repo whose subject is the
// photograph's gallery, so a like here is a like on grain.social too.
//
// The page's counts come from the server (Constellation). This keeps track of
// which galleries the signed-in reader likes, signs them in with their
// Atmosphere account when they need it, and writes or deletes their records.
// It only changes in the browser (on mount, and on clicks), never while the
// server renders, so one instance serves the whole page.
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { CALLBACK_PATH, METADATA_PATH, moveToLoopback, rememberDid } from '@bnb/atmosphere';
import type { OAuthClient, Session } from '@bnb/atmosphere/oauth';
import { FAVORITE, SCOPE } from './site';

/** a like the reader asked for before signing in, kept for the page they come back to */
const PENDING_KEY = 'tierney.camera:like';
/** how long a failed like's message stays up */
export const MESSAGE_MS = 6_000;

// the OAuth client and the repo writes are most of the weight, so they load
// only for a returning reader or a click
const loadOAuth = () => import('@bnb/atmosphere/oauth');

/** What signing in carries through to the callback page. */
interface CallbackState {
	like?: string;
	returnTo?: string;
}

const pendingLike = {
	take(): string | null {
		try {
			const subject = window.sessionStorage.getItem(PENDING_KEY);
			window.sessionStorage.removeItem(PENDING_KEY);
			return subject;
		} catch {
			return null;
		}
	},
	set(subject: string) {
		try {
			window.sessionStorage.setItem(PENDING_KEY, subject);
		} catch {
			// the like is lost, but their heart is one click away
		}
	}
};

/** Every like in the reader's repo. A record's subject is whatever its author wrote, so check it. */
async function favorites(session: Session) {
	const { listRecords } = await loadOAuth();
	return listRecords<{ subject?: unknown }>(session, FAVORITE);
}

export class Likes {
	/** the galleries the signed-in reader likes */
	readonly liked = new SvelteSet<string>();
	/** a failed like's message, by gallery, for a few seconds */
	readonly errors = new SvelteMap<string, string>();
	/** the reader's own likes (+1) and unlikes (-1) since the page's counts were read */
	readonly #delta = new SvelteMap<string, number>();
	readonly #pending = new Set<string>();
	readonly #remembered = rememberDid('tierney.camera:did');
	#session: Session | null = null;
	#restoring: Promise<string | null> | undefined;
	#client: OAuthClient | undefined;

	/** The count to show: the server's, plus the reader's own clicks. Undefined when the server couldn't count. */
	count(subject: string, counted: number | undefined): number | undefined {
		return counted === undefined
			? undefined
			: Math.max(0, counted + (this.#delta.get(subject) ?? 0));
	}

	async #oauth(): Promise<OAuthClient> {
		const { oauthClient } = await loadOAuth();
		const { origin } = window.location;
		this.#client ??= oauthClient({
			clientId: new URL(METADATA_PATH, origin).href,
			callbackUrl: new URL(CALLBACK_PATH, origin).href,
			handleResolver: 'https://api.bsky.app',
			scope: SCOPE
		});
		return this.#client;
	}

	/**
	 * For the page, once it's in the browser: restores a returning reader's
	 * session and marks what they like. A like they asked for before signing in
	 * is done now, and its gallery handed back (so the page can show it).
	 */
	restore(): Promise<string | null> {
		this.#restoring ??= (async () => {
			const did = this.#remembered.get();
			if (!did) return null;
			try {
				this.#session = await (await this.#oauth()).restore(did);
				if (!this.#session) return null;
				for (const { value } of await favorites(this.#session)) {
					if (typeof value.subject === 'string') this.liked.add(value.subject);
				}
			} catch {
				// can't tell what they like; their next click finds out
			}
			const pending = this.#session && pendingLike.take();
			if (!pending || this.liked.has(pending)) return null;
			await this.#write(pending, true);
			return pending;
		})();
		return this.#restoring;
	}

	/**
	 * Likes or unlikes a gallery for the signed-in reader, or says they need to
	 * sign in first (`'sign-in'`). A returning reader whose session expired is
	 * sent straight back to their authorization server.
	 */
	async toggle(subject: string): Promise<'sign-in' | undefined> {
		if (this.#pending.has(subject) || moveToLoopback()) return;
		await this.restore();
		if (this.#session) {
			await this.#write(subject, !this.liked.has(subject));
			return;
		}
		const did = this.#remembered.get();
		if (!did) return 'sign-in';
		// the page is on its way out; if it can't go, they can type their handle
		return this.signIn(did, subject).then(
			() => undefined,
			() => 'sign-in' as const
		);
	}

	/** Leaves for the reader's authorization server, to come back and like `subject`. Throws if it can't. */
	async signIn(identity: string, subject: string): Promise<void> {
		const state: CallbackState = { like: subject, returnTo: window.location.href };
		await (await this.#oauth()).signIn(identity, state);
	}

	/** For the callback page: finishes signing in, and says where to send the reader. */
	async finish(): Promise<string> {
		const { session, state, cancelled } = await (await this.#oauth()).callback<CallbackState>();
		if (session && !cancelled) {
			this.#remembered.set(session.did);
			if (state.like) pendingLike.set(state.like);
		}
		// only ever back to this site
		const home = new URL('/', window.location.origin);
		const back = new URL(state.returnTo || home, home);
		return back.origin === home.origin ? back.href : home.href;
	}

	// optimistic: the heart and count change at once, and change back if the
	// write fails. Liking checks the repo first, so a like made in another tab
	// isn't doubled; unliking deletes every like of the gallery, duplicates too.
	async #write(subject: string, like: boolean) {
		const session = this.#session!;
		this.#pending.add(subject);
		this.errors.delete(subject);
		this.#apply(subject, like);
		try {
			const { createRecord, deleteRecord } = await loadOAuth();
			const mine = (await favorites(session)).filter((record) => record.value.subject === subject);
			if (like && !mine.length) {
				await createRecord(session, FAVORITE, { subject, createdAt: new Date().toISOString() });
			}
			if (!like) for (const { rkey } of mine) await deleteRecord(session, FAVORITE, rkey);
		} catch {
			this.#apply(subject, !like);
			this.#fail(subject, like ? "Couldn't save your like." : "Couldn't remove your like.");
		} finally {
			this.#pending.delete(subject);
		}
	}

	#apply(subject: string, like: boolean) {
		if (like) this.liked.add(subject);
		else this.liked.delete(subject);
		this.#delta.set(subject, (this.#delta.get(subject) ?? 0) + (like ? 1 : -1));
	}

	#fail(subject: string, message: string) {
		this.errors.set(subject, message);
		setTimeout(() => {
			if (this.errors.get(subject) === message) this.errors.delete(subject);
		}, MESSAGE_MS);
	}
}

export const likes = new Likes();
