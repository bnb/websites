// Writing as the reader, for the upvote button and the comments. Their saved
// session is restored when they act. With none, or one their PDS refuses (it
// expired, or it was signed in when the site asked for less), they sign in
// again, which leaves the page; the action is finished when they're back.
import { moveToLoopback, needsSignIn } from '@bnb/atmosphere';
import type { Session } from '@bnb/atmosphere/oauth';
import { storage, type ClientConfig, type Pending } from './shared';

const loadOAuth = () => import('./oauth');
type OAuth = Awaited<ReturnType<typeof loadOAuth>>;

/** The page is leaving: for the reader's authorization server, or for 127.0.0.1 in local dev. */
export const LEAVING = 'leaving';
/** Nobody has signed in here: ask for their handle. */
export const SIGN_IN = 'sign-in';

export type Outcome<T> = { done: T } | typeof LEAVING | typeof SIGN_IN;

export class Writer {
	constructor(readonly config: ClientConfig) {}

	/**
	 * Runs `write` with the reader's session. `again: false` is for finishing an
	 * action after signing in, so a session that still won't do fails instead of
	 * sending the reader round again.
	 */
	async act<T>(
		action: Pending,
		write: (oauth: OAuth, session: Session) => Promise<T>,
		{ again = true } = {}
	): Promise<Outcome<T>> {
		if (moveToLoopback()) return LEAVING;
		const did = storage.get();
		if (!did) return SIGN_IN;
		const oauth = await loadOAuth();
		const session = await oauth.restore(this.config, did);
		if (session) {
			try {
				return { done: await write(oauth, session) };
			} catch (error) {
				if (!again || !needsSignIn(error)) throw error;
			}
		} else if (!again) {
			throw new Error('Still signed out');
		}
		await this.signIn(did, action);
		return LEAVING;
	}

	/** Leaves for the reader's authorization server; `action` is finished when they're back. Throws if it can't. */
	async signIn(identity: string, action?: Pending) {
		const oauth = await loadOAuth();
		await oauth.signIn(this.config, identity, { pending: action, returnTo: window.location.href });
	}

	async signOut() {
		const did = storage.get();
		if (!did) return;
		storage.clear();
		await (await loadOAuth()).signOut(this.config, did);
	}
}
