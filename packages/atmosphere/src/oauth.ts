// Signing readers in with their Atmosphere account (ATProto OAuth, in the
// browser), and writing to their repo once they are. This pulls in
// @atproto/oauth-client-browser, which is most of the weight, so load it with
// a dynamic import() once a reader clicks or a returning reader's session
// needs restoring.
import {
	BrowserOAuthClient,
	atprotoLoopbackClientMetadata,
	buildAtprotoLoopbackClientId,
	type OAuthSession
} from '@atproto/oauth-client-browser';
import { AtmosphereError } from './errors';
import { isLoopback } from './loopback';
import { LOOPBACK_HOSTS } from './site';

export type { OAuthSession };
export { createRecord, deleteRecord, listRecords, type Session } from './repo';

export interface OAuthConfig {
	/** the site's hosted client metadata (unused in local dev) */
	clientId: string;
	/** the site's callback page */
	callbackUrl: string;
	/** where the handle a reader types is resolved */
	handleResolver: string;
	/** what the site may do in the reader's repo; see repoScope */
	scope: string;
}

/** How a sign-in came back: the session and the state it started with, or `cancelled`. */
export interface Callback<State> {
	session?: OAuthSession;
	state: State;
	cancelled?: boolean;
}

const failed = (error: unknown) =>
	error instanceof AtmosphereError
		? error
		: new AtmosphereError('auth', (error as Error).message, undefined, { cause: error });

export type OAuthClient = ReturnType<typeof oauthClient>;

/** A site's sign-in. The OAuth client is made on first use, then kept. */
export function oauthClient({ clientId, callbackUrl, handleResolver, scope }: OAuthConfig) {
	let client: Promise<BrowserOAuthClient> | undefined;

	async function create() {
		const options = { handleResolver, responseMode: 'fragment' as const };
		if (!isLoopback()) return BrowserOAuthClient.load({ clientId, ...options });
		// in local dev, a loopback client id stands in for the hosted metadata
		// file, which the authorization server can't fetch
		const redirect = new URL(callbackUrl);
		redirect.hostname = LOOPBACK_HOSTS[0];
		const clientMetadata = atprotoLoopbackClientMetadata(
			buildAtprotoLoopbackClientId({
				scope,
				redirect_uris: [redirect.href as `http://127.0.0.1${string}`]
			})
		);
		return new BrowserOAuthClient({ clientMetadata, ...options });
	}

	// a failure isn't kept, so the next click tries again
	const get = () =>
		(client ??= create().catch((error: unknown) => {
			client = undefined;
			throw failed(error);
		}));

	return {
		/** A session saved from an earlier sign-in, or null if it's gone or expired. */
		async restore(did: string): Promise<OAuthSession | null> {
			try {
				return await (await get()).restore(did);
			} catch {
				return null;
			}
		},

		/** Leaves the page for the reader's authorization server; `state` comes back to the callback page. */
		async signIn(identity: string, state: object): Promise<void> {
			try {
				await (await get()).signInRedirect(identity, { scope, state: JSON.stringify(state) });
			} catch (error) {
				throw failed(error);
			}
		},

		/**
		 * Finishes signing in, on the callback page. A reader who backed out at
		 * the authorization server comes back as `cancelled`, with their state.
		 */
		async callback<State extends object>(): Promise<Callback<State>> {
			try {
				const result = await (await get()).initCallback();
				if (!result) {
					throw new AtmosphereError(
						'auth',
						'Nothing to finish: this page is for coming back from signing in.'
					);
				}
				return { session: result.session, state: JSON.parse(result.state || '{}') as State };
			} catch (error) {
				const details = error as { params?: URLSearchParams; state?: string };
				if (details.params?.get('error') === 'access_denied' && details.state) {
					return { cancelled: true, state: JSON.parse(details.state) as State };
				}
				throw failed(error);
			}
		},

		/** Forgets the reader's session here and revokes it, as far as their server can be reached. */
		async signOut(did: string): Promise<void> {
			try {
				await (await get()).revoke(did);
			} catch {
				// already gone, or their server is down: it's forgotten here either way
			}
		}
	};
}
