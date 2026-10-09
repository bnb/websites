import type { OAuthSession } from '@atproto/oauth-client-browser';
import { isLoopback } from '@bnb/atmosphere';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCOPE, SUBSCRIPTION } from '../constants';
import { fakeRepo } from '@bnb/atmosphere/testing/repo';
import { json } from '../test/fetch';
import {
	atprotoLoopbackClientMetadata,
	BrowserOAuthClient,
	buildAtprotoLoopbackClientId,
	client,
	construct,
	resetClient
} from '@bnb/atmosphere/testing/oauth-client';
import * as oauth from './oauth';

vi.mock('@atproto/oauth-client-browser', () => import('@bnb/atmosphere/testing/oauth-client'));

const PUBLICATION = 'at://did:plc:author/site.standard.publication/3lpub';
const config = {
	clientId: 'http://localhost:8080/blog/oauth-client-metadata.json',
	callbackUrl: 'http://localhost:8080/blog/oauth/callback/',
	handleResolver: 'https://resolver.example'
};

beforeEach(() => {
	resetClient();
});

afterEach(() => {
	vi.restoreAllMocks();
});

const session = (response = json({})) => {
	const fetchHandler = vi.fn(async (_pathname: string, _init: RequestInit) => response.clone());
	return { did: 'did:plc:reader', fetchHandler } as unknown as OAuthSession & {
		fetchHandler: typeof fetchHandler;
	};
};
const notSubscribed = async () => [];

// what the OAuth client throws for an error response from the server
const oauthError = (error: string, state?: string) =>
	Object.assign(new Error(error), { params: new URLSearchParams({ error }), state });

// the XRPC calls a session made, checked to be JSON POSTs
const xrpcCalls = (s: ReturnType<typeof session>) =>
	s.fetchHandler.mock.calls.map(([pathname, init]) => {
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({ 'content-type': 'application/json' });
		return [pathname, JSON.parse(String(init.body))];
	});

describe('the OAuth client', () => {
	it('is a loopback client on 127.0.0.1, redirecting there whatever host the callback names', async () => {
		expect(window.location.hostname).toBe('127.0.0.1');
		expect(isLoopback()).toBe(true);
		await oauth.restore(config, 'did:plc:reader');

		expect(buildAtprotoLoopbackClientId).toHaveBeenCalledWith({
			scope: SCOPE,
			redirect_uris: ['http://127.0.0.1:8080/blog/oauth/callback/']
		});
		expect(atprotoLoopbackClientMetadata).toHaveBeenCalledWith('http://localhost?loopback');
		expect(construct).toHaveBeenCalledWith({
			clientMetadata: { client_id: 'http://localhost?loopback' },
			handleResolver: 'https://resolver.example',
			responseMode: 'fragment'
		});
		// the hosted metadata can't be fetched from a loopback address
		expect(BrowserOAuthClient.load).not.toHaveBeenCalled();

		// and it's made once, then kept
		await oauth.restore(config, 'did:plc:reader');
		await oauth.signIn(
			{ ...config, handleResolver: 'https://other.example' },
			'reader.example',
			{}
		);
		expect(construct).toHaveBeenCalledTimes(1);
		expect(client.restore).toHaveBeenCalledTimes(2);
		expect(client.signInRedirect).toHaveBeenCalledTimes(1);
	});
});

describe('subscribe', () => {
	it('writes a subscription record to the reader’s repo', async () => {
		const s = session();
		const find = vi.fn(notSubscribed);
		const before = Date.now();
		await oauth.subscribe(s, PUBLICATION, find);
		expect(find).toHaveBeenCalledWith('did:plc:reader', PUBLICATION);
		const [[pathname, body]] = xrpcCalls(s);
		expect(pathname).toBe('/xrpc/com.atproto.repo.createRecord');
		expect(body).toEqual({
			repo: 'did:plc:reader',
			collection: SUBSCRIPTION,
			record: { $type: SUBSCRIPTION, publication: PUBLICATION, createdAt: expect.any(String) }
		});
		const createdAt = Date.parse(body.record.createdAt);
		expect(createdAt).toBeGreaterThanOrEqual(before);
		expect(createdAt).toBeLessThanOrEqual(Date.now());
		expect(new Date(createdAt).toISOString()).toBe(body.record.createdAt);
	});

	it('doesn’t add a second record for the same publication', async () => {
		const s = session();
		await oauth.subscribe(s, PUBLICATION, async () => ['3kexisting']);
		expect(s.fetchHandler).not.toHaveBeenCalled();
	});

	it('says what the PDS said when it fails', async () => {
		const subscribing = (response: Response) =>
			oauth.subscribe(session(response), PUBLICATION, notSubscribed);
		// the message, or else the error code, or else the status
		await expect(
			subscribing(json({ error: 'InvalidRequest', message: 'Bad record' }, 400))
		).rejects.toMatchObject({ message: 'Bad record' });
		await expect(subscribing(json({ error: 'ExpiredToken' }, 401))).rejects.toMatchObject({
			message: 'ExpiredToken'
		});
		await expect(subscribing(new Response('nope', { status: 502 }))).rejects.toMatchObject({
			message: 'com.atproto.repo.createRecord failed with 502'
		});
	});
});

describe('unsubscribe', () => {
	it('deletes every subscription record the reader has to the publication', async () => {
		const s = session();
		// a duplicate, from subscribing in two tabs at once
		await oauth.unsubscribe(s, PUBLICATION, async () => ['3kexisting', '3kdupe']);
		expect(xrpcCalls(s)).toEqual(
			['3kexisting', '3kdupe'].map((rkey) => [
				'/xrpc/com.atproto.repo.deleteRecord',
				{ repo: 'did:plc:reader', collection: SUBSCRIPTION, rkey }
			])
		);
	});

	it('does nothing for a reader who isn’t subscribed', async () => {
		const s = session();
		await oauth.unsubscribe(s, PUBLICATION, notSubscribed);
		expect(s.fetchHandler).not.toHaveBeenCalled();
	});

	it('stops at the first delete that fails', async () => {
		const s = session(json({ error: 'InvalidRequest' }, 400));
		await expect(oauth.unsubscribe(s, PUBLICATION, async () => ['3ka', '3kb'])).rejects.toThrow(
			'InvalidRequest'
		);
		expect(s.fetchHandler).toHaveBeenCalledTimes(1);
	});
});

describe('restore', () => {
	it('hands back a saved session, or null when it’s gone', async () => {
		const saved = session();
		client.restore.mockImplementation(async (did: string) => {
			if (did === 'did:plc:reader') return saved;
			throw new Error('TokenRefreshError');
		});
		await expect(oauth.restore(config, 'did:plc:reader')).resolves.toBe(saved);
		await expect(oauth.restore(config, 'did:plc:expired')).resolves.toBeNull();
	});
});

describe('signIn', () => {
	it('asks for the subscription scope, and carries the state through', async () => {
		const state = {
			action: 'subscribe' as const,
			publication: PUBLICATION,
			returnTo: 'https://x/'
		};
		await oauth.signIn(config, 'reader.example', state);
		expect(client.signInRedirect).toHaveBeenCalledWith('reader.example', {
			scope: SCOPE,
			state: JSON.stringify(state)
		});
	});
});

describe('callback', () => {
	it('hands back the session and the state signing in started with', async () => {
		const s = session();
		client.initCallback.mockResolvedValue({ session: s, state: '{"action":"subscribe"}' });
		await expect(oauth.callback(config)).resolves.toEqual({
			session: s,
			state: { action: 'subscribe' }
		});

		client.initCallback.mockResolvedValue({ session: s, state: null });
		await expect(oauth.callback(config)).resolves.toEqual({ session: s, state: {} });
	});

	it('fails on a page that isn’t coming back from signing in', async () => {
		client.initCallback.mockResolvedValue(null);
		await expect(oauth.callback(config)).rejects.toThrow(
			'Nothing to finish: this page is for coming back from signing in.'
		);
	});

	it('reports a reader who backed out as cancelled', async () => {
		client.initCallback.mockRejectedValue(
			oauthError('access_denied', '{"returnTo":"https://example.com/"}')
		);
		await expect(oauth.callback(config)).resolves.toEqual({
			cancelled: true,
			state: { returnTo: 'https://example.com/' }
		});
	});

	it('rethrows anything else', async () => {
		// backing out with no state to go back with
		client.initCallback.mockRejectedValue(oauthError('access_denied'));
		await expect(oauth.callback(config)).rejects.toThrow('access_denied');

		client.initCallback.mockRejectedValue(oauthError('server_error', '{}'));
		await expect(oauth.callback(config)).rejects.toThrow('server_error');

		client.initCallback.mockRejectedValue(new Error('Invalid state'));
		await expect(oauth.callback(config)).rejects.toThrow('Invalid state');
	});
});

describe('deleteComment', () => {
	it('deletes the reader’s own comment, and only theirs', async () => {
		const repo = fakeRepo({
			records: { 'at.upvote.comment': [{ rkey: '3kmine', value: {} }] }
		});
		await oauth.deleteComment(repo.session, 'at://did:plc:reader/at.upvote.comment/3kmine');
		expect(repo.records['at.upvote.comment']).toEqual([]);
		await expect(
			oauth.deleteComment(repo.session, 'at://did:plc:someone/at.upvote.comment/3kmine')
		).rejects.toThrow("That comment isn't yours to delete.");
		await expect(
			oauth.deleteComment(repo.session, 'at://did:plc:reader/site.standard.document/3kmine')
		).rejects.toThrow("That comment isn't yours to delete.");
		expect(repo.calls).toHaveLength(1);
	});
});

describe('signOut', () => {
	it('revokes the reader’s session', async () => {
		await oauth.signOut(config, 'did:plc:reader');
		expect(client.revoke).toHaveBeenCalledWith('did:plc:reader');
	});
});
