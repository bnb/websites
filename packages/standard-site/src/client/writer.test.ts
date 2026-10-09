// What the browser tests can't show, since their page is always on
// 127.0.0.1: a reader acting from localhost in local development. Run in Node,
// with a stand-in window whose location can be anything.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Writer } from './writer';

vi.mock('@atproto/oauth-client-browser', () => import('@bnb/atmosphere/testing/oauth-client'));

const config = {
	clientId: 'http://localhost:5174/oauth-client-metadata.json',
	callbackUrl: 'http://localhost:5174/oauth/callback/',
	handleResolver: 'https://resolver.example'
};

function at(hostname: string, stored: string | null = null) {
	const location = { hostname, href: `http://${hostname}:5174/posts/hello/` };
	const localStorage = {
		getItem: () => stored,
		setItem: vi.fn(),
		removeItem: vi.fn()
	};
	vi.stubGlobal('window', { location, localStorage });
	return { location, localStorage };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Writer', () => {
	it('moves local dev from localhost to 127.0.0.1 before anything else, and does nothing more', async () => {
		const { location } = at('localhost', 'did:plc:reader');
		const write = vi.fn();
		const outcome = await new Writer(config).act(
			{ kind: 'upvote', subject: 'at://x/y/z', on: true },
			write
		);
		expect(outcome).toBe('leaving');
		expect(location.hostname).toBe('127.0.0.1');
		expect(write).not.toHaveBeenCalled();
	});

	it('asks a reader nobody has signed in as to sign in', async () => {
		at('bnb.im');
		const outcome = await new Writer(config).act(
			{ kind: 'upvote', subject: 'at://x/y/z', on: true },
			vi.fn()
		);
		expect(outcome).toBe('sign-in');
	});

	it('has nothing to sign out of when nobody’s signed in', async () => {
		const { localStorage } = at('bnb.im');
		await new Writer(config).signOut();
		expect(localStorage.removeItem).not.toHaveBeenCalled();
	});
});
