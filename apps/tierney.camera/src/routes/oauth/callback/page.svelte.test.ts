import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { interceptNavigation } from '@bnb/atmosphere/testing/navigation';
import { client, resetClient } from '@bnb/atmosphere/testing/oauth-client';
import Callback from './+page.svelte';

vi.mock('@atproto/oauth-client-browser', () => import('@bnb/atmosphere/testing/oauth-client'));

const GALLERY = 'at://did:plc:author/social.grain.gallery/3lbushwick';
const HOME = new URL('/', window.location.origin).href;
const PHOTOGRAPHS = new URL('/?from=a-link', window.location.origin).href;
const session = { did: 'did:plc:reader' };

const signedIn = (state: Record<string, unknown>) =>
	client.initCallback.mockResolvedValue({ session, state: JSON.stringify(state) });

beforeEach(() => {
	resetClient();
	window.localStorage.clear();
	window.sessionStorage.clear();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('the OAuth callback page', () => {
	it('finishes signing in and sends the reader back, to make their like there', async () => {
		const destinations = interceptNavigation();
		signedIn({ like: GALLERY, returnTo: PHOTOGRAPHS });
		await render(Callback);
		await expect.element(page.getByRole('status')).toHaveTextContent('Signing you in…');
		await vi.waitFor(() => expect(destinations).toEqual([PHOTOGRAPHS]));
		expect(window.localStorage.getItem('tierney.camera:did')).toBe(session.did);
		expect(window.sessionStorage.getItem('tierney.camera:like')).toBe(GALLERY);
	});

	it('sends a reader who backed out back, without signing them in', async () => {
		const destinations = interceptNavigation();
		client.initCallback.mockRejectedValue(
			Object.assign(new Error('access_denied'), {
				params: new URLSearchParams({ error: 'access_denied' }),
				state: JSON.stringify({ like: GALLERY, returnTo: PHOTOGRAPHS })
			})
		);
		await render(Callback);
		await vi.waitFor(() => expect(destinations).toEqual([PHOTOGRAPHS]));
		expect(window.localStorage.getItem('tierney.camera:did')).toBeNull();
		expect(window.sessionStorage.getItem('tierney.camera:like')).toBeNull();
	});

	it('only ever sends readers back to this site', async () => {
		const destinations = interceptNavigation();
		signedIn({ returnTo: 'https://elsewhere.example/phish' });
		await render(Callback);
		await vi.waitFor(() => expect(destinations).toEqual([HOME]));
	});

	it('goes home when there’s nowhere to go back to', async () => {
		const destinations = interceptNavigation();
		signedIn({});
		await render(Callback);
		await vi.waitFor(() => expect(destinations).toEqual([HOME]));
		expect(window.sessionStorage.getItem('tierney.camera:like')).toBeNull();
	});

	it('says so when it can’t finish, with a way back', async () => {
		const destinations = interceptNavigation();
		client.initCallback.mockRejectedValue(new Error('Unknown state'));
		await render(Callback);
		await expect.element(page.getByRole('status')).toHaveTextContent("Couldn't finish signing in.");
		await expect
			.element(page.getByRole('link', { name: 'Back to the photographs' }))
			.toHaveAttribute('href', '/');
		expect(destinations).toEqual([]);
	});

	it('keeps itself out of search results', async () => {
		client.initCallback.mockRejectedValue(new Error('Unknown state'));
		await render(Callback);
		await expect.element(page.getByRole('status')).toHaveTextContent("Couldn't finish signing in.");
		expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
			'noindex'
		);
	});

	it('still sends the reader back with storage blocked', async () => {
		const destinations = interceptNavigation();
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('The operation is insecure.', 'SecurityError');
		});
		signedIn({ like: GALLERY, returnTo: PHOTOGRAPHS });
		await render(Callback);
		await vi.waitFor(() => expect(destinations).toEqual([PHOTOGRAPHS]));
	});
});
