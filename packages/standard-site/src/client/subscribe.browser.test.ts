import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCOPE } from '../constants';
import { interceptNavigation } from '@bnb/atmosphere/testing/navigation';
import { fakeReader, READER } from '../test/browser';
import { json } from '../test/fetch';
import {
	BrowserOAuthClient,
	buildAtprotoLoopbackClientId,
	client,
	construct,
	resetClient
} from '@bnb/atmosphere/testing/oauth-client';
import { findSubscriptions, StandardSiteSubscribe } from './subscribe';

vi.mock('@atproto/oauth-client-browser', () => import('@bnb/atmosphere/testing/oauth-client'));

const PUBLICATION = 'at://did:plc:author/site.standard.publication/3lpub';
const OTHER = 'at://did:plc:someone/site.standard.publication/3lother';
const STORAGE_KEY = 'standard-site:did';

beforeEach(() => {
	resetClient();
	window.localStorage.clear();
	document.body.innerHTML = '';
});

afterEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
});

// a button on the page, as a site renders it
function button(attributes = 'label="Follow along"') {
	document.body.innerHTML = `<standard-site-subscribe publication="${PUBLICATION}" ${attributes}></standard-site-subscribe>`;
	return document.querySelector('standard-site-subscribe') as StandardSiteSubscribe;
}
const click = (el: Element, action: string) =>
	el.querySelector<HTMLElement>(`[data-action="${action}"]`)!.click();
const submit = (el: Element, handle: string) => {
	el.querySelector('input')!.value = handle;
	el.querySelector('form')!.requestSubmit();
};
const returning = (did = READER) => window.localStorage.setItem(STORAGE_KEY, did);
const error = (el: Element) => el.querySelector('.standard-site-subscribe-error');
const state = (el: HTMLElement) => el.dataset.state;

describe('<standard-site-subscribe>', () => {
	it('is defined as a custom element', () => {
		expect(customElements.get('standard-site-subscribe')).toBe(StandardSiteSubscribe);
		expect(button()).toBeInstanceOf(StandardSiteSubscribe);
	});

	it('shows a button with its label, as text', () => {
		const el = button('label="<img src=x onerror=alert(1)> & &quot;go&quot;"');
		expect(state(el)).toBe('idle');
		const subscribe = el.querySelector('button')!;
		expect(subscribe.dataset.action).toBe('subscribe');
		expect(subscribe.textContent).toBe('<img src=x onerror=alert(1)> & "go"');
		expect(el.querySelector('img')).toBeNull();
		expect(button('').textContent).toBe('Subscribe');
		expect(button('label=""').textContent).toBe('Subscribe');
	});

	it('asks a new reader for their handle, and lets them back out', () => {
		const el = button();
		click(el, 'subscribe');
		expect(state(el)).toBe('form');
		const input = el.querySelector('input')!;
		expect(document.activeElement).toBe(input);
		expect(input.required).toBe(true);
		expect(el.querySelector('label')!.htmlFor).toBe(input.id);
		expect(el.textContent).toContain('Works with any Atmosphere account');
		click(el, 'cancel');
		expect(state(el)).toBe('idle');
		expect(el.querySelector('form')).toBeNull();
	});

	it('signs a new reader in with the handle they typed', async () => {
		const el = button('handle-resolver="https://resolver.example"');
		click(el, 'subscribe');
		submit(el, '  @reader.example ');
		await vi.waitFor(() => expect(client.signInRedirect).toHaveBeenCalled());

		expect(client.signInRedirect).toHaveBeenCalledWith('reader.example', {
			scope: SCOPE,
			state: JSON.stringify({
				action: 'subscribe',
				publication: PUBLICATION,
				returnTo: window.location.href
			})
		});
		// a handle isn't a DID, so there's no saved session to look for
		expect(client.restore).not.toHaveBeenCalled();
		// the page is on its way to the reader's authorization server
		expect(state(el)).toBe('busy');
		const busy = el.querySelector('button')!;
		expect(busy.disabled).toBe(true);
		expect(busy.textContent).toBe('Working…');

		// the tests are served from 127.0.0.1, so the OAuth client is a loopback
		// one, made on the first click, that comes back to the callback page
		expect(BrowserOAuthClient.load).not.toHaveBeenCalled();
		expect(construct).toHaveBeenCalledTimes(1);
		expect(construct).toHaveBeenCalledWith({
			clientMetadata: { client_id: 'http://localhost?loopback' },
			handleResolver: 'https://resolver.example',
			responseMode: 'fragment'
		});
		const [{ redirect_uris }] = vi.mocked(buildAtprotoLoopbackClientId).mock.calls[0] as [
			{ redirect_uris: string[] }
		];
		expect(new URL(redirect_uris[0]).pathname.endsWith('/oauth/callback/')).toBe(true);
		expect(new URL(redirect_uris[0]).origin).toBe(window.location.origin);
	});

	it('shows a returning reader that they’re subscribed', async () => {
		returning();
		// on the second page of their subscriptions
		fakeReader({
			subscriptions: [
				{ rkey: '3kother', publication: OTHER },
				{ rkey: '3kmine', publication: PUBLICATION }
			]
		});
		const el = button();
		await vi.waitFor(() => expect(state(el)).toBe('subscribed'));
		expect(el.textContent).toContain("You're subscribed.");
		expect(el.querySelector('[data-action="unsubscribe"]')).not.toBeNull();
	});

	it('looks up readers with did:web identities too', async () => {
		const did = 'did:web:reader.example%3A8443';
		returning(did);
		const reader = fakeReader({
			did,
			subscriptions: [{ rkey: '3kmine', publication: PUBLICATION }]
		});
		const el = button();
		await vi.waitFor(() => expect(state(el)).toBe('subscribed'));
		expect(String(reader.fetch.mock.calls[0][0])).toBe(
			'https://reader.example:8443/.well-known/did.json'
		);
	});

	it('shows a returning reader who isn’t subscribed the button', async () => {
		returning();
		const reader = fakeReader({ subscriptions: [{ rkey: '3kother', publication: OTHER }] });
		const refresh = vi.spyOn(StandardSiteSubscribe.prototype, 'refresh');
		const el = button();
		await refresh.mock.results[0].value;
		expect(state(el)).toBe('idle');
		// the DID document, then both pages of subscriptions (the second empty)
		expect(reader.fetch).toHaveBeenCalledTimes(3);
		expect(reader.calls).toEqual([]);
	});

	it('doesn’t look anything up for a new reader', async () => {
		const fetch = vi.spyOn(globalThis, 'fetch');
		await button().refresh();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('leaves the button as it is when it can’t tell if a reader is subscribed', async () => {
		returning();
		const reader = fakeReader();
		const failures: Array<(url: URL) => Response | null> = [
			(url) => (url.hostname === 'plc.directory' ? new Response('', { status: 404 }) : null),
			(url) => (url.hostname === 'plc.directory' ? json({}) : null),
			(url) => (url.pathname.endsWith('listRecords') ? new Response('', { status: 500 }) : null)
		];
		const refresh = vi.spyOn(StandardSiteSubscribe.prototype, 'refresh');
		const render = vi.spyOn(StandardSiteSubscribe.prototype, 'render');
		for (const failure of failures) {
			reader.fail = failure;
			render.mockClear();
			const el = button();
			await refresh.mock.results.at(-1)!.value;
			// rendered when it was added, and not again
			expect(render).toHaveBeenCalledTimes(1);
			expect(state(el)).toBe('idle');
		}
	});

	it('subscribes a returning reader with their saved session', async () => {
		returning();
		const reader = fakeReader();
		client.restore.mockResolvedValue(reader.session);
		const el = button();
		click(el, 'subscribe');
		await vi.waitFor(() => expect(state(el)).toBe('subscribed'));
		expect(client.restore).toHaveBeenCalledWith(READER);
		expect(reader.calls).toEqual([
			[
				'/xrpc/com.atproto.repo.createRecord',
				{
					repo: READER,
					collection: 'site.standard.graph.subscription',
					record: {
						$type: 'site.standard.graph.subscription',
						publication: PUBLICATION,
						createdAt: expect.any(String)
					}
				}
			]
		]);
		expect(client.signInRedirect).not.toHaveBeenCalled();
	});

	it('unsubscribes a reader with their saved session, duplicates and all', async () => {
		returning();
		const reader = fakeReader({
			subscriptions: [
				{ rkey: '3kmine', publication: PUBLICATION },
				{ rkey: '3kother', publication: OTHER },
				{ rkey: '3kdupe', publication: PUBLICATION }
			]
		});
		client.restore.mockResolvedValue(reader.session);
		const el = button();
		await vi.waitFor(() => expect(state(el)).toBe('subscribed'));
		click(el, 'unsubscribe');
		expect(state(el)).toBe('busy');
		await vi.waitFor(() => expect(state(el)).toBe('idle'));
		expect(reader.calls).toEqual(
			['3kmine', '3kdupe'].map((rkey) => [
				'/xrpc/com.atproto.repo.deleteRecord',
				{ repo: READER, collection: 'site.standard.graph.subscription', rkey }
			])
		);
		expect(reader.subscriptions.map((sub) => sub.rkey)).toEqual(['3kother']);
	});

	it('signs a returning reader in again when their session is gone', async () => {
		returning();
		fakeReader({ subscriptions: [{ rkey: '3kmine', publication: PUBLICATION }] });
		const el = button();
		await vi.waitFor(() => expect(state(el)).toBe('subscribed'));
		click(el, 'unsubscribe');
		await vi.waitFor(() => expect(client.signInRedirect).toHaveBeenCalled());
		const [identity, { state: callbackState }] = client.signInRedirect.mock.calls[0] as [
			string,
			{ state: string }
		];
		expect(identity).toBe(READER);
		expect(JSON.parse(callbackState)).toMatchObject({
			action: 'unsubscribe',
			publication: PUBLICATION
		});
	});

	it('shows a new reader what went wrong, with the form to fix their handle', async () => {
		client.signInRedirect.mockRejectedValue(new Error("Couldn't resolve <b>handle</b>"));
		const el = button();
		click(el, 'subscribe');
		submit(el, 'nobody.example');
		await vi.waitFor(() => expect(error(el)).not.toBeNull());
		expect(state(el)).toBe('form');
		expect(error(el)!.getAttribute('role')).toBe('alert');
		expect(error(el)!.textContent).toBe("Couldn't resolve <b>handle</b>");
		expect(error(el)!.querySelector('b')).toBeNull();
		// and they can try again
		client.signInRedirect.mockResolvedValue(undefined);
		submit(el, 'reader.example');
		await vi.waitFor(() =>
			expect(client.signInRedirect).toHaveBeenLastCalledWith('reader.example', expect.anything())
		);
	});

	it('shows a returning reader what went wrong, with the button back', async () => {
		returning();
		const reader = fakeReader();
		reader.fetchHandler.mockResolvedValue(json({ message: 'Repo is read-only' }, 400));
		client.restore.mockResolvedValue(reader.session);
		const el = button();
		click(el, 'subscribe');
		await vi.waitFor(() => expect(error(el)).not.toBeNull());
		expect(state(el)).toBe('idle');
		expect(error(el)!.textContent).toBe('Repo is read-only');
		expect(el.querySelector('[data-action="subscribe"]')).not.toBeNull();
	});

	it('works with storage blocked, as a new reader every time', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new DOMException('The operation is insecure.', 'SecurityError');
		});
		const fetch = vi.spyOn(globalThis, 'fetch');
		const el = button();
		await el.refresh();
		expect(fetch).not.toHaveBeenCalled();
		click(el, 'subscribe');
		expect(state(el)).toBe('form');
	});

	it('takes the publication it subscribes to from its attribute', async () => {
		document.body.innerHTML = `<standard-site-subscribe publication="${OTHER}"></standard-site-subscribe>`;
		const el = document.querySelector('standard-site-subscribe') as StandardSiteSubscribe;
		expect(el.publication).toBe(OTHER);
		expect(el.label).toBe('Subscribe');
		const bare = document.createElement('standard-site-subscribe') as StandardSiteSubscribe;
		document.body.append(bare);
		expect(bare.publication).toBe('');
	});

	it('is only defined once, however many times the script loads', async () => {
		const specifier = './subscribe.ts?again';
		const again = (await import(/* @vite-ignore */ specifier)) as typeof import('./subscribe');
		expect(again.StandardSiteSubscribe).not.toBe(StandardSiteSubscribe);
		expect(customElements.get('standard-site-subscribe')).toBe(StandardSiteSubscribe);
	});

	it('doesn’t move a page that’s already on 127.0.0.1', () => {
		const destinations = interceptNavigation();
		const el = button();
		click(el, 'subscribe');
		submit(el, 'reader.example');
		expect(destinations).toEqual([]);
	});
});

describe('findSubscriptions', () => {
	it('lists the rkeys of a reader’s subscriptions to a publication, across pages', async () => {
		fakeReader({
			subscriptions: [
				{ rkey: '3ka', publication: PUBLICATION },
				{ rkey: '3kb', publication: OTHER },
				{ rkey: '3kc', publication: PUBLICATION }
			]
		});
		await expect(findSubscriptions(READER, PUBLICATION)).resolves.toEqual(['3ka', '3kc']);
		await expect(findSubscriptions(READER, 'at://nobody/x.y.z/1')).resolves.toEqual([]);
	});

	it('says why it couldn’t look', async () => {
		const reader = fakeReader();
		reader.fail = (url) =>
			url.hostname === 'plc.directory' ? new Response('', { status: 404 }) : null;
		await expect(findSubscriptions(READER, PUBLICATION)).rejects.toThrow(
			`Couldn't resolve ${READER}`
		);
		reader.fail = (url) => (url.hostname === 'plc.directory' ? json({ service: [] }) : null);
		await expect(findSubscriptions(READER, PUBLICATION)).rejects.toThrow(`${READER} has no PDS`);
		reader.fail = (url) => (url.hostname === 'plc.directory' ? json({}) : null);
		await expect(findSubscriptions(READER, PUBLICATION)).rejects.toThrow(`${READER} has no PDS`);
		reader.fail = (url) =>
			url.pathname.endsWith('listRecords') ? new Response('', { status: 502 }) : null;
		await expect(findSubscriptions(READER, PUBLICATION)).rejects.toThrow(
			"Couldn't list subscriptions: 502"
		);
	});
});
