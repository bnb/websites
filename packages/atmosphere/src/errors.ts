/**
 * What went wrong talking to the Atmosphere: the host never answered
 * (`network`), took too long (`timeout`), answered with an error (`http`, with
 * its status), answered with something other than what was asked for
 * (`invalid`), or signing in failed (`auth`). Every helper in this package
 * throws this and nothing else, so UI code can catch one type.
 */
export class AtmosphereError extends Error {
	override readonly name = 'AtmosphereError';

	constructor(
		readonly kind: 'network' | 'timeout' | 'http' | 'invalid' | 'auth',
		message: string,
		readonly status?: number,
		options?: ErrorOptions
	) {
		super(message, options);
	}
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

/** An XRPC error body's message, or else its error code. */
export function errorMessage(body: unknown): string | undefined {
	if (!isObject(body)) return undefined;
	const { message, error } = body;
	return (
		(typeof message === 'string' && message) || (typeof error === 'string' && error) || undefined
	);
}

/** A failed fetch as an AtmosphereError: a timeout, or a host that never answered. */
export function unreachable(what: string, error: unknown): AtmosphereError {
	const options = { cause: error };
	if (error instanceof DOMException && error.name === 'TimeoutError') {
		return new AtmosphereError('timeout', `${what} took too long`, undefined, options);
	}
	const message = (error as Error).message || `${what} didn't answer`;
	return new AtmosphereError('network', message, undefined, options);
}

// what @atproto/oauth-client throws when a session can't be used any more
const DEAD_SESSION = /^Token(Refresh|Revoked|Invalid)Error$/;

/**
 * Whether a write failed because the reader has to sign in again: their
 * session is gone, or the PDS refused it (401 or 403, as it does for a session
 * signed in with a narrower scope than the site now asks for).
 */
export const needsSignIn = (error: unknown): boolean =>
	error instanceof AtmosphereError &&
	(error.kind === 'auth' ||
		(error.kind === 'http' && (error.status === 401 || error.status === 403)));

/** A session that couldn't make a request, as an AtmosphereError. */
export function sessionFailed(nsid: string, error: unknown): AtmosphereError {
	if (error instanceof Error && DEAD_SESSION.test(error.name)) {
		return new AtmosphereError('auth', error.message || 'Signed out', undefined, { cause: error });
	}
	return unreachable(nsid, error);
}
