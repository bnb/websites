// Stands in for @atproto/oauth-client-browser in tests, which mock it with this
// module: vi.mock('@atproto/oauth-client-browser', () =>
// import('@bnb/atmosphere/testing/oauth-client')). There's no real OAuth flow,
// just spies the tests script and check.
import { vi } from 'vitest';

/** The client every BrowserOAuthClient, loaded or constructed, turns out to be. */
export const client = {
	restore: vi.fn(),
	signInRedirect: vi.fn(),
	initCallback: vi.fn(),
	revoke: vi.fn()
};

/** Called with what `new BrowserOAuthClient(...)` was handed. */
export const construct = vi.fn();

export class BrowserOAuthClient {
	static load = vi.fn(async (_options: unknown) => client);

	constructor(options: unknown) {
		construct(options);
		return client as unknown as BrowserOAuthClient;
	}
}

export const buildAtprotoLoopbackClientId = vi.fn(
	(_config: unknown) => 'http://localhost?loopback'
);
export const atprotoLoopbackClientMetadata = vi.fn((clientId: string) => ({ client_id: clientId }));

/** Back to a client with no saved session, that signs in without leaving the page. */
export function resetClient() {
	client.restore.mockReset().mockRejectedValue(new Error('no saved session'));
	client.signInRedirect.mockReset().mockResolvedValue(undefined);
	client.initCallback.mockReset().mockRejectedValue(new Error('not mocked in this test'));
	client.revoke.mockReset().mockResolvedValue(undefined);
}
