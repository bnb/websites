// What the browser tests can't show, since their page is always on
// 127.0.0.1: a site on a real host, and local development on localhost. Run
// in Node, with a stand-in window whose location can be anything.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@atproto/oauth-client-browser', () => import('@bnb/atmosphere/testing/oauth-client'));

// each test loads the modules afresh (oauth.ts keeps its client); the mock
// hands every one of them the same stand-in, which is reset in between
let fake: typeof import('@bnb/atmosphere/testing/oauth-client');

const config = {
	clientId: 'https://example.com/blog/oauth-client-metadata.json',
	callbackUrl: 'https://example.com/blog/oauth/callback/',
	handleResolver: 'https://resolver.example'
};

// a window at `hostname`, which records where the page is sent
function at(hostname: string) {
	const location = { hostname, href: `http://${hostname}/blog/` };
	vi.stubGlobal('window', { location });
	return location;
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	fake = (await import('@atproto/oauth-client-browser')) as unknown as typeof fake;
	fake.resetClient();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('isLoopback', () => {
	it.each([
		['127.0.0.1', true],
		['localhost', true],
		['[::1]', true],
		['example.com', false],
		['127.0.0.1.example.com', false]
	])('is %s for %s', async (hostname, loopback) => {
		at(hostname);
		const { isLoopback } = await import('@bnb/atmosphere');
		expect(isLoopback()).toBe(loopback);
	});
});

describe('the OAuth client', () => {
	it('loads from the hosted metadata on a real site', async () => {
		at('example.com');
		const oauth = await import('./oauth');
		await oauth.restore(config, 'did:plc:reader');
		await oauth.signIn(config, 'reader.example', {});
		expect(fake.BrowserOAuthClient.load).toHaveBeenCalledTimes(1);
		expect(fake.BrowserOAuthClient.load).toHaveBeenCalledWith({
			clientId: config.clientId,
			handleResolver: config.handleResolver,
			responseMode: 'fragment'
		});
		expect(fake.construct).not.toHaveBeenCalled();
		expect(fake.client.restore).toHaveBeenCalledWith('did:plc:reader');
		expect(fake.client.signInRedirect).toHaveBeenCalledTimes(1);
	});

	it('is a loopback client on localhost, redirecting to 127.0.0.1', async () => {
		at('localhost');
		const oauth = await import('./oauth');
		await oauth.restore(
			{ ...config, callbackUrl: 'http://localhost:8080/blog/oauth/callback/' },
			'did:plc:reader'
		);
		expect(fake.buildAtprotoLoopbackClientId).toHaveBeenCalledWith({
			scope: expect.any(String),
			redirect_uris: ['http://127.0.0.1:8080/blog/oauth/callback/']
		});
		expect(fake.construct).toHaveBeenCalledTimes(1);
		expect(fake.BrowserOAuthClient.load).not.toHaveBeenCalled();
	});
});

describe('the subscribe button in local development', () => {
	// just enough of a DOM for the script to load and define its element
	async function load() {
		vi.stubGlobal(
			'HTMLElement',
			class {
				dataset: Record<string, string> = {};
			}
		);
		const define = vi.fn();
		vi.stubGlobal('customElements', { get: vi.fn(), define });
		vi.stubGlobal('document', { documentElement: { hasAttribute: () => false } });
		const module = await import('./subscribe');
		expect(define).toHaveBeenCalledWith('standard-site-subscribe', module.StandardSiteSubscribe);
		return module;
	}

	it.each(['localhost', '[::1]'])(
		'moves from %s to 127.0.0.1 before signing in, where the callback lands',
		async (hostname) => {
			const location = at(hostname);
			const { StandardSiteSubscribe } = await load();
			const el = new StandardSiteSubscribe();
			const render = vi.spyOn(el, 'render').mockImplementation(() => {});
			await el.start('subscribe', 'reader.example');
			expect(location.hostname).toBe('127.0.0.1');
			// and does nothing else, since the page is leaving
			expect(render).not.toHaveBeenCalled();
			expect(fake.client.signInRedirect).not.toHaveBeenCalled();
		}
	);

	it('stays on 127.0.0.1, and signs in from there', async () => {
		const location = at('127.0.0.1');
		const { StandardSiteSubscribe } = await load();
		const el = new StandardSiteSubscribe();
		const render = vi.spyOn(el, 'render').mockImplementation(() => {});
		await el.start('subscribe', 'reader.example');
		expect(location.hostname).toBe('127.0.0.1');
		expect(render).toHaveBeenCalledWith('busy');
		expect(fake.client.signInRedirect).toHaveBeenCalledWith('reader.example', expect.anything());
	});
});
