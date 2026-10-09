// What the site's scripts share: where its OAuth client lives, which reader
// signed in last, and an action a reader asked for before signing in (kept in
// this tab while they're away at their authorization server).
import { rememberDid } from '@bnb/atmosphere';
import { CALLBACK_PATH, METADATA_PATH } from '../constants';

export interface ClientConfig {
	clientId: string;
	callbackUrl: string;
	handleResolver: string;
}

/**
 * The OAuth client's URLs, from where a script is served: the scripts sit in
 * /standard-site/, next to the metadata and the callback page. `base` is the
 * script's own import.meta.url (a chunk's would be a folder deeper).
 */
export const clientConfig = (base: string, handleResolver?: string | null): ClientConfig => ({
	clientId: new URL(`..${METADATA_PATH}`, base).href,
	callbackUrl: new URL(`..${CALLBACK_PATH}`, base).href,
	handleResolver: handleResolver || 'https://api.bsky.app'
});

/** The reader who signed in last, on any of the site's buttons. */
export const storage = rememberDid('standard-site:did');

/** Something a reader asked to do before they'd signed in, done once they're back. */
export type Pending =
	| { kind: 'upvote'; subject: string; on: boolean }
	| { kind: 'comment'; subject: string; rootSubject: string; text: string }
	| { kind: 'delete'; uri: string; rootSubject: string }
	/** they signed in to write a comment, or a reply, on `subject` */
	| { kind: 'compose'; subject: string; rootSubject: string };

const PENDING_KEY = 'standard-site:pending';

export const pending = {
	set(action: Pending) {
		try {
			window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(action));
		} catch {
			// it's lost, but what they asked for is one click away
		}
	},
	/** The pending action, if `mine` says it's this element's, which then forgets it. */
	take<T extends Pending>(mine: (action: Pending) => action is T): T | null {
		try {
			const action = JSON.parse(
				window.sessionStorage.getItem(PENDING_KEY) ?? 'null'
			) as Pending | null;
			if (!action || !mine(action)) return null;
			window.sessionStorage.removeItem(PENDING_KEY);
			return action;
		} catch {
			return null;
		}
	}
};

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};
const ESCAPED = /[&<>"']/g;
export const escapeHtml = (str = '') => String(str).replace(ESCAPED, (char) => ESCAPES[char]);

export const AT_SIGN = /^@/;
