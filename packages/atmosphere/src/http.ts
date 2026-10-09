import { AtmosphereError, errorMessage, unreachable } from './errors';

/** How long a read waits before giving up, unless it's told otherwise. */
const TIMEOUT = 10_000;

export interface ReadOptions {
	/** milliseconds before the request (headers and body) is abandoned */
	timeout?: number;
	/** a stand-in for the global fetch */
	fetch?: typeof fetch;
}

/** GETs `url` and hands back its JSON, or throws an AtmosphereError. */
export async function getJson(
	url: URL,
	{ timeout = TIMEOUT, fetch: fetchFn = fetch }: ReadOptions = {}
): Promise<unknown> {
	let response: Response;
	try {
		response = await fetchFn(url, { signal: AbortSignal.timeout(timeout) });
	} catch (error) {
		throw unreachable(url.host, error);
	}
	let body: unknown;
	try {
		body = await response.json();
	} catch (error) {
		// a body cut off by the timeout counts as the host being slow
		if (error instanceof DOMException) throw unreachable(url.host, error);
		body = undefined;
	}
	if (!response.ok) {
		throw new AtmosphereError(
			'http',
			errorMessage(body) ?? `${url.host} answered ${response.status}`,
			response.status
		);
	}
	if (body === undefined) throw invalid(url);
	return body;
}

export const invalid = (url: URL) =>
	new AtmosphereError('invalid', `${url.host} sent an answer this client doesn't understand`);
