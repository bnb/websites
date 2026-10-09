import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { MIXES } from '$lib/fixtures';
import Page from './+page.svelte';

const mixes = MIXES.map((mix) => ({ ...mix, image: '' }));
const props = (data: object) => ({ data, params: {} }) as never;

/** Every AT Tag in the head, as [property, AT URI] pairs. */
const atTagsInHead = () =>
	Array.from(document.head.querySelectorAll('meta[name^="at:"]'), (meta) => [
		meta.getAttribute('name'),
		meta.getAttribute('content')
	]);

describe('the page', () => {
	it('puts the masthead, marquee and mixes in order', async () => {
		const { container } = await render(
			Page,
			props({ bio: 'girl rave dj in bushwick', mixes, pds: '', loadError: false })
		);
		expect(container.querySelector('.run')?.textContent).toContain('girl rave dj in bushwick');
		expect(document.title).toBe('tierney cyren · dj');
		expect(document.head.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
			'summary_large_image'
		);
		expect(container.querySelector('#info dd')?.textContent).toBe('2 mixes · 1 hr 19 min');
	});

	it('maps the page to its plyr.fm records with AT Tags', async () => {
		const profile = 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/fm.plyr.actor.profile/self';
		const withProfile = await render(
			Page,
			props({ bio: 'girl rave dj', profile, mixes, pds: '', loadError: false })
		);
		expect(atTagsInHead()).toEqual([
			['at:alternate', profile],
			...mixes.map((mix) => ['at:alternate', mix.uri]),
			['at:author', 'at://did:plc:uashgn65n5z7aqwk5cbuba5c']
		]);
		withProfile.unmount();

		await render(Page, props({ bio: '', profile: null, mixes: [], pds: '', loadError: true }));
		expect(atTagsInHead()).toEqual([['at:author', 'at://did:plc:uashgn65n5z7aqwk5cbuba5c']]);
	});

	it('shares the generated card, versioned by the newest mix, and falls back when the PDS is down', async () => {
		const ogImage = () =>
			document.head.querySelector('meta[property="og:image"]')?.getAttribute('content');
		const withMixes = await render(Page, props({ bio: '', mixes, pds: '', loadError: false }));
		expect(ogImage()).toBe('https://tierneycyren.com/og.png?v=3muhqykl7gz22');
		expect(
			document.head.querySelector('meta[property="og:image:width"]')?.getAttribute('content')
		).toBe('1200');
		expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
			'girl rave dj'
		);
		withMixes.unmount();

		await render(Page, props({ bio: '', mixes: [], pds: '', loadError: true }));
		expect(ogImage()).toBe('https://tierneycyren.com/og.png');
	});
});
