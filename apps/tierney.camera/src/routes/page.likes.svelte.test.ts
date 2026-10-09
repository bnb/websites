// The home page with a reader coming back from signing in to like a photograph.
// A file of its own, since the page's likes restore once per load, as on the site.
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { client, resetClient } from '@bnb/atmosphere/testing/oauth-client';
import { fakeRepo } from '@bnb/atmosphere/testing/repo';
import type { Photo } from '$lib/types';
import Page from './+page.svelte';

vi.mock('@atproto/oauth-client-browser', () => import('@bnb/atmosphere/testing/oauth-client'));

// a tiny in-page image stands in for the CDN, so nothing touches the network
vi.mock('$lib/atproto', async (importOriginal) => {
	const stub = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"/>')}`;
	return {
		...(await importOriginal<typeof import('$lib/atproto')>()),
		thumbUrl: () => stub,
		fullUrl: () => stub,
		blobUrl: () => stub
	};
});

const photo = (n: number, gallery: string): Photo => ({
	uri: `at://photo/${n}`,
	cid: `cid-${n}`,
	width: 3000,
	height: 2000,
	alt: '',
	date: '2026-07-09T14:00:50Z',
	posted: `2026-09-${String(20 - n).padStart(2, '0')}T00:00:00Z`,
	place: `Place ${n}, New York`,
	gallery,
	camera: '',
	lens: '',
	focal: '',
	aperture: '',
	shutter: '',
	iso: '',
	ev: null
});

describe('home page, back from signing in', () => {
	it('makes the like the reader signed in for, and shows it where they made it', async () => {
		resetClient();
		const galleries = Array.from(
			{ length: 12 },
			(_, n) => `at://did:plc:author/social.grain.gallery/${n}`
		);
		const last = galleries.at(-1)!;
		const repo = fakeRepo();
		window.localStorage.setItem('tierney.camera:did', repo.did);
		window.sessionStorage.setItem('tierney.camera:like', last);
		client.restore.mockResolvedValue(repo.session);

		await render(Page, {
			data: {
				profile: null,
				photos: galleries.map((gallery, n) => photo(n + 1, gallery)),
				pds: 'https://pds.test',
				palettes: {},
				likes: { [last]: 2 },
				latest: {},
				loadError: false
			}
		});

		const heart = page.getByRole('button', { name: 'Like photograph 12, 3 likes' });
		await expect.element(heart).toHaveAttribute('aria-pressed', 'true');
		expect(repo.records['social.grain.favorite'].map((record) => record.value.subject)).toEqual([
			last
		]);
		// the last photograph, scrolled to the middle of the screen
		await vi.waitFor(() => {
			const { top, bottom } = heart.element().getBoundingClientRect();
			expect(top).toBeGreaterThan(0);
			expect(bottom).toBeLessThan(window.innerHeight);
		});
	});
});
