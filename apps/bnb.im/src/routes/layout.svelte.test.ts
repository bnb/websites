import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Layout from './+layout.svelte';

const state = vi.hoisted(() => ({ page: { url: new URL('https://bnb.im/') } }));
vi.mock('$app/state', () => state);

const data = {
	topics: ['AT Protocol', 'Node.js'],
	atTags: [{ name: 'at:me', content: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c' }],
	latest: {}
};
const children = createRawSnippet(() => ({ render: () => '<p>the writing</p>' }));

describe('root layout', () => {
	afterEach(() => {
		state.page.url = new URL('https://bnb.im/');
	});

	it('wraps the page in the header, main landmark and footer', async () => {
		await render(Layout, { data, children });

		await expect.element(page.getByRole('main').getByText('the writing')).toBeVisible();
		expect(page.getByRole('main').element().id).toBe('main');
		await expect
			.element(page.getByRole('link', { name: 'Skip to content' }))
			.toHaveAttribute('href', '#main');
		await expect.element(page.getByRole('link', { name: 'RSS' })).toBeVisible();
		await expect
			.element(
				page
					.getByRole('navigation', { name: "Tierney's sites" })
					.getByRole('link', { name: 'bnb.im' })
			)
			.toHaveAttribute('aria-current', 'true');
		await expect.element(page.getByRole('contentinfo')).toHaveTextContent(':)');
		await expect
			.element(page.getByRole('checkbox', { name: 'Pause the marquee' }))
			.toBeInTheDocument();
	});

	it('sets the name as the heading on the home page only', async () => {
		const home = await render(Layout, { data, children });
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Tierney Cyren.');
		home.unmount();

		state.page.url = new URL('https://bnb.im/posts/is-mdm/');
		const { container } = await render(Layout, { data, children });
		expect(container.querySelector('h1')).toBeNull();
	});

	it('links the feed and writes the AT Tags in the head', async () => {
		await render(Layout, { data, children });
		const feed = document.head.querySelector('link[rel="alternate"][type="application/atom+xml"]');
		expect(feed?.getAttribute('href')).toBe('https://bnb.im/feed.xml');
		expect(feed?.getAttribute('title')).toBe('Tierney Cyren - Software and Selected Garbage');
		expect(document.head.querySelector('meta[name="at:me"]')?.getAttribute('content')).toBe(
			'at://did:plc:uashgn65n5z7aqwk5cbuba5c'
		);
	});

	it('gives the rail the other sites’ newest items', async () => {
		await render(Layout, {
			data: { ...data, latest: { camera: { kind: 'photo', date: '2026-09-16T20:14:27.303Z' } } },
			children
		});
		await expect
			.element(
				page
					.getByRole('navigation', { name: "Tierney's sites" })
					.getByRole('link', { name: 'tierney.camera' })
			)
			.toHaveAccessibleDescription('Newest photo: Sep 16, 2026');
	});
});
