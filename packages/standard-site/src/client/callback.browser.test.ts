// The callback page: the same script as the button, loaded on a page marked
// with data-standard-site-callback, where it finishes signing in instead.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { interceptNavigation } from '@bnb/atmosphere/testing/navigation';
import { fakeReader, READER } from '../test/browser';
import { client, construct, resetClient } from '@bnb/atmosphere/testing/oauth-client';

vi.mock('@atproto/oauth-client-browser', () => import('@bnb/atmosphere/testing/oauth-client'));

const PUBLICATION = 'at://did:plc:author/site.standard.publication/3lpub';
const POST = new URL('/blog/posts/hello/', window.location.origin).href;
const STORAGE_KEY = 'standard-site:did';

// the callback page, as a site serves it
document.documentElement.setAttribute('data-standard-site-callback', '');
document.documentElement.setAttribute('data-handle-resolver', 'https://resolver.example');

beforeEach(() => {
	resetClient();
	window.localStorage.clear();
	document.body.innerHTML = '<p data-standard-site-status>Finishing your subscription…</p>';
});

afterEach(() => {
	vi.restoreAllMocks();
});

const status = () => document.querySelector('[data-standard-site-status]');
const signedIn = (session: unknown, state?: Record<string, unknown>) =>
	client.initCallback.mockResolvedValue({ session, state: state && JSON.stringify(state) });

// the site's root, worked out from where the script is served, as the link
// on the error page gives it
async function home() {
	client.initCallback.mockRejectedValue(new Error('x'));
	const { handleCallback } = await import('./subscribe');
	await handleCallback();
	return status()!.querySelector('a')!.href;
}

describe('the callback page', () => {
	it('finishes subscribing as it loads, and sends the reader back to the post', async () => {
		const destinations = interceptNavigation();
		const reader = fakeReader();
		signedIn(reader.session, { action: 'subscribe', publication: PUBLICATION, returnTo: POST });

		await import('./subscribe');
		await vi.waitFor(() => expect(destinations).toEqual([POST]));

		expect(window.localStorage.getItem(STORAGE_KEY)).toBe(READER);
		expect(reader.subscriptions).toEqual([{ rkey: '3knew', publication: PUBLICATION }]);
		expect(construct).toHaveBeenCalledWith(
			expect.objectContaining({ handleResolver: 'https://resolver.example' })
		);
		// the page isn't a button, so the element isn't defined
		expect(customElements.get('standard-site-subscribe')).toBeUndefined();
	});

	it('finishes unsubscribing', async () => {
		const destinations = interceptNavigation();
		const reader = fakeReader({ subscriptions: [{ rkey: '3kmine', publication: PUBLICATION }] });
		signedIn(reader.session, { action: 'unsubscribe', publication: PUBLICATION, returnTo: POST });
		const { handleCallback } = await import('./subscribe');
		await handleCallback();
		expect(reader.subscriptions).toEqual([]);
		expect(destinations).toEqual([POST]);
	});

	it('sends a reader who backed out back, without signing them in', async () => {
		const destinations = interceptNavigation();
		client.initCallback.mockRejectedValue(
			Object.assign(new Error('access_denied'), {
				params: new URLSearchParams({ error: 'access_denied' }),
				state: JSON.stringify({ action: 'subscribe', returnTo: POST })
			})
		);
		const { handleCallback } = await import('./subscribe');
		await handleCallback();
		expect(destinations).toEqual([POST]);
		expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	it('only sends readers back to pages on this site', async () => {
		const root = await home();
		const destinations = interceptNavigation();
		const reader = fakeReader();
		signedIn(reader.session, {
			action: 'subscribe',
			publication: PUBLICATION,
			returnTo: 'https://elsewhere.example/phish'
		});
		const { handleCallback } = await import('./subscribe');
		await handleCallback();
		expect(destinations).toEqual([root]);
		// it still did what the reader asked
		expect(reader.calls).toHaveLength(1);
	});

	it('goes to the site’s home when there’s no page to go back to, or nothing to do', async () => {
		const root = await home();
		// the directory above the script's own (/standard-site/ on a real site)
		expect(new URL(root).origin).toBe(window.location.origin);
		expect(root.endsWith('/src/')).toBe(true);
		const destinations = interceptNavigation();
		const reader = fakeReader();
		signedIn(reader.session);
		const { handleCallback } = await import('./subscribe');
		await handleCallback();
		expect(destinations).toEqual([root]);
		expect(reader.calls).toEqual([]);
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe(READER);
	});

	it('keeps a returnTo relative to the site', async () => {
		const destinations = interceptNavigation();
		signedIn(fakeReader().session, { returnTo: '/blog/posts/relative/' });
		const { handleCallback } = await import('./subscribe');
		await handleCallback();
		expect(destinations).toEqual([new URL('/blog/posts/relative/', window.location.origin).href]);
	});

	it('still sends the reader back with storage blocked', async () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('The operation is insecure.', 'SecurityError');
		});
		const destinations = interceptNavigation();
		signedIn(fakeReader().session, { returnTo: POST });
		const { handleCallback } = await import('./subscribe');
		await handleCallback();
		expect(destinations).toEqual([POST]);
	});

	it('shows what went wrong, with a way back', async () => {
		const root = await home();
		const destinations = interceptNavigation();
		client.initCallback.mockRejectedValue(new Error('Unknown <state>'));
		const { handleCallback } = await import('./subscribe');
		await handleCallback();
		expect(status()!.innerHTML).toBe(
			`Something went wrong: Unknown &lt;state&gt;. <a href="${root}">Head back</a> and try again.`
		);
		expect(destinations).toEqual([]);
	});

	it('shows an error from the reader’s PDS the same way', async () => {
		const destinations = interceptNavigation();
		const reader = fakeReader();
		reader.fetchHandler.mockResolvedValue(new Response('{}', { status: 500 }));
		signedIn(reader.session, { action: 'subscribe', publication: PUBLICATION, returnTo: POST });
		const { handleCallback } = await import('./subscribe');
		await handleCallback();
		expect(status()!.textContent).toBe(
			'Something went wrong: com.atproto.repo.createRecord failed with 500. Head back and try again.'
		);
		expect(destinations).toEqual([]);
	});

	it('stays put when there’s no status line to show an error in', async () => {
		status()!.remove();
		client.initCallback.mockRejectedValue(new Error('Unknown state'));
		const { handleCallback } = await import('./subscribe');
		await expect(handleCallback()).resolves.toBeUndefined();
		expect(client.initCallback).toHaveBeenCalledTimes(1);
	});

	it('keeps an upvote or comment for the post page to finish', async () => {
		const destinations = interceptNavigation();
		const reader = fakeReader();
		const action = {
			kind: 'comment',
			subject: 'at://x/y/z',
			rootSubject: 'at://x/y/z',
			text: 'hi'
		};
		signedIn(reader.session, { pending: action, returnTo: POST });
		const { handleCallback } = await import('./subscribe');
		await handleCallback();
		expect(destinations).toEqual([POST]);
		expect(JSON.parse(window.sessionStorage.getItem('standard-site:pending')!)).toEqual(action);
		expect(reader.calls).toEqual([]);
		window.sessionStorage.clear();
	});
});
