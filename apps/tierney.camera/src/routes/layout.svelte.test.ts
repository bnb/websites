import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Layout from './+layout.svelte';

const state = vi.hoisted(() => ({
	page: { error: null as { message: string } | null, route: { id: '/' as string | null } }
}));
vi.mock('$app/state', () => state);

const data = { latest: {} };

const children = createRawSnippet(() => ({ render: () => '<p>the photographs</p>' }));

describe('root layout', () => {
	afterEach(() => {
		state.page.error = null;
		state.page.route.id = '/';
	});

	it('renders the page and marks the document as hydrated', async () => {
		const html = document.documentElement;
		html.classList.remove('hydrated');

		await render(Layout, { data, children });

		await expect.element(page.getByText('the photographs')).toBeVisible();
		// app.html's no-JS fallback watches for this to keep the reveal animations on
		expect(html.classList.contains('hydrated')).toBe(true);
	});

	it('puts the skip link ahead of the rail, with this site marked current', async () => {
		const { container } = await render(Layout, { data, children });

		const skip = page.getByRole('link', { name: 'Skip to photographs' });
		await expect.element(skip).toHaveAttribute('href', '#work');
		expect(container.querySelector('a')).toBe(skip.element());
		await expect
			.element(
				page
					.getByRole('navigation', { name: "Tierney's sites" })
					.getByRole('link', { name: 'tierney.camera' })
			)
			.toHaveAttribute('aria-current', 'true');
	});

	it('names the account behind the site on every page', async () => {
		await render(Layout, { data, children });
		expect(document.head.querySelector('meta[name="at:me"]')?.getAttribute('content')).toBe(
			'at://did:plc:uashgn65n5z7aqwk5cbuba5c'
		);
	});

	it('leaves the skip link off error pages', async () => {
		state.page.error = { message: 'Not found' };
		await render(Layout, { data, children });
		await expect
			.element(page.getByRole('link', { name: 'Skip to photographs' }))
			.not.toBeInTheDocument();
	});

	it('leaves the skip link off pages without photographs, like the sign-in callback', async () => {
		state.page.route.id = '/oauth/callback';
		await render(Layout, { data, children });
		await expect
			.element(page.getByRole('link', { name: 'Skip to photographs' }))
			.not.toBeInTheDocument();
	});

	it('gives the rail the other sites’ newest items', async () => {
		await render(Layout, {
			data: {
				latest: { dj: { kind: 'mix', title: 'tachycardia 028', date: '2026-08-25T23:53:12Z' } }
			},
			children
		});
		await expect
			.element(
				page
					.getByRole('navigation', { name: "Tierney's sites" })
					.getByRole('link', { name: 'tierneycyren.com' })
			)
			.toHaveAccessibleDescription('Newest mix: tachycardia 028, Aug 25, 2026');
	});
});
