import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtmosphereError } from './errors';
import { oauthClient } from './oauth';
import {
	atprotoLoopbackClientMetadata,
	BrowserOAuthClient,
	buildAtprotoLoopbackClientId,
	client,
	construct,
	resetClient
} from './testing/oauth-client';

vi.mock('@atproto/oauth-client-browser', () => import('./testing/oauth-client'));

const SCOPE = 'atproto repo:social.grain.favorite?action=create&action=delete';
const config = {
	clientId: 'https://tierney.camera/oauth-client-metadata.json',
	callbackUrl: 'https://tierney.camera/oauth/callback/',
	handleResolver: 'https://resolver.example',
	scope: SCOPE
};
const session = { did: 'did:plc:reader' };

const at = (hostname: string) => vi.stubGlobal('window', { location: { hostname } });

// what the OAuth client throws for an error response from the server
const oauthError = (error: string, state?: string) =>
	Object.assign(new Error(error), { params: new URLSearchParams({ error }), state });

beforeEach(() => {
	vi.clearAllMocks();
	resetClient();
	at('tierney.camera');
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('the OAuth client', () => {
	it('loads from the site’s hosted metadata, once', async () => {
		const oauth = oauthClient(config);
		await oauth.restore('did:plc:reader');
		await oauth.signIn('reader.example', {});
		expect(BrowserOAuthClient.load).toHaveBeenCalledOnce();
		expect(BrowserOAuthClient.load).toHaveBeenCalledWith({
			clientId: config.clientId,
			handleResolver: 'https://resolver.example',
			responseMode: 'fragment'
		});
		expect(construct).not.toHaveBeenCalled();
	});

	it('is a loopback client in local dev, redirecting to 127.0.0.1 with the site’s scope', async () => {
		at('localhost');
		const oauth = oauthClient({
			...config,
			callbackUrl: 'http://localhost:5173/oauth/callback/'
		});
		await oauth.restore('did:plc:reader');
		expect(buildAtprotoLoopbackClientId).toHaveBeenCalledWith({
			scope: SCOPE,
			redirect_uris: ['http://127.0.0.1:5173/oauth/callback/']
		});
		expect(atprotoLoopbackClientMetadata).toHaveBeenCalledWith('http://localhost?loopback');
		expect(construct).toHaveBeenCalledWith({
			clientMetadata: { client_id: 'http://localhost?loopback' },
			handleResolver: 'https://resolver.example',
			responseMode: 'fragment'
		});
		expect(BrowserOAuthClient.load).not.toHaveBeenCalled();
	});

	it('tries loading again after a failure', async () => {
		BrowserOAuthClient.load.mockRejectedValueOnce(new Error('metadata unreachable'));
		const oauth = oauthClient(config);
		await expect(oauth.signIn('reader.example', {})).rejects.toMatchObject({
			kind: 'auth',
			message: 'metadata unreachable'
		});
		await oauth.signIn('reader.example', {});
		expect(BrowserOAuthClient.load).toHaveBeenCalledTimes(2);
		expect(client.signInRedirect).toHaveBeenCalledOnce();
	});

	it('keeps each site’s client to itself', async () => {
		await oauthClient(config).restore('did:plc:reader');
		await oauthClient(config).restore('did:plc:reader');
		expect(BrowserOAuthClient.load).toHaveBeenCalledTimes(2);
	});
});

describe('restore', () => {
	it('hands back a saved session, or null when it’s gone', async () => {
		client.restore.mockImplementation(async (did: string) => {
			if (did === 'did:plc:reader') return session;
			throw new Error('TokenRefreshError');
		});
		const oauth = oauthClient(config);
		await expect(oauth.restore('did:plc:reader')).resolves.toBe(session);
		await expect(oauth.restore('did:plc:expired')).resolves.toBeNull();
	});
});

describe('signIn', () => {
	it('asks for the site’s scope, and carries the state through', async () => {
		const state = { like: 'at://did:plc:author/social.grain.gallery/3lg', returnTo: '/' };
		await oauthClient(config).signIn('reader.example', state);
		expect(client.signInRedirect).toHaveBeenCalledWith('reader.example', {
			scope: SCOPE,
			state: JSON.stringify(state)
		});
	});

	it('fails with what went wrong', async () => {
		client.signInRedirect.mockRejectedValue(
			new Error('Failed to resolve identity: nobody.example')
		);
		const error = await oauthClient(config)
			.signIn('nobody.example', {})
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(AtmosphereError);
		expect(error).toMatchObject({
			kind: 'auth',
			message: 'Failed to resolve identity: nobody.example'
		});
	});
});

describe('callback', () => {
	it('hands back the session and the state signing in started with', async () => {
		const oauth = oauthClient(config);
		client.initCallback.mockResolvedValue({ session, state: '{"like":"at://x/y/z"}' });
		await expect(oauth.callback()).resolves.toEqual({ session, state: { like: 'at://x/y/z' } });
		client.initCallback.mockResolvedValue({ session, state: null });
		await expect(oauth.callback()).resolves.toEqual({ session, state: {} });
	});

	it('fails on a page that isn’t coming back from signing in', async () => {
		client.initCallback.mockResolvedValue(null);
		await expect(oauthClient(config).callback()).rejects.toMatchObject({
			kind: 'auth',
			message: 'Nothing to finish: this page is for coming back from signing in.'
		});
	});

	it('reports a reader who backed out as cancelled', async () => {
		client.initCallback.mockRejectedValue(oauthError('access_denied', '{"returnTo":"/"}'));
		await expect(oauthClient(config).callback()).resolves.toEqual({
			cancelled: true,
			state: { returnTo: '/' }
		});
	});

	it('rethrows anything else, as an AtmosphereError', async () => {
		const oauth = oauthClient(config);
		for (const error of [
			oauthError('access_denied'),
			oauthError('server_error', '{}'),
			new Error('Invalid state')
		]) {
			client.initCallback.mockRejectedValue(error);
			await expect(oauth.callback()).rejects.toMatchObject({
				name: 'AtmosphereError',
				message: error.message
			});
		}
	});
});

describe('signOut', () => {
	it('revokes the reader’s session', async () => {
		await oauthClient(config).signOut('did:plc:reader');
		expect(client.revoke).toHaveBeenCalledWith('did:plc:reader');
	});

	it('still counts as signed out when their server can’t be reached', async () => {
		client.revoke.mockRejectedValue(new Error('Failed to fetch'));
		await expect(oauthClient(config).signOut('did:plc:reader')).resolves.toBeUndefined();
	});
});
