import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Layout from './+layout.svelte';

const state = vi.hoisted(() => ({ page: { error: null as { message: string } | null } }));
vi.mock('$app/state', () => state);

const data = { latest: {} };

const children = createRawSnippet(() => ({ render: () => '<p class="child">page</p>' }));

describe('layout', () => {
	afterEach(() => {
		state.page.error = null;
	});

	it('renders the page inside the theme', async () => {
		const { container } = await render(Layout, { data, children });
		expect(container.querySelector('.child')?.textContent).toBe('page');
	});

	it('puts the skip link ahead of the rail, with this site marked current', async () => {
		const { container } = await render(Layout, { data, children });

		const skip = page.getByRole('link', { name: 'Skip to the mixes' });
		await expect.element(skip).toHaveAttribute('href', '#mixes');
		expect(container.querySelector('a')).toBe(skip.element());
		await expect
			.element(
				page
					.getByRole('navigation', { name: "Tierney's sites" })
					.getByRole('link', { name: 'tierneycyren.com' })
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
			.element(page.getByRole('link', { name: 'Skip to the mixes' }))
			.not.toBeInTheDocument();
	});

	it('gives the rail the other sites’ newest items', async () => {
		await render(Layout, {
			data: {
				latest: {
					camera: {
						kind: 'photo',
						image: { src: 'https://cdn.example/photo.jpg', alt: 'A Bushwick rooftop at dusk' },
						date: '2026-09-17T20:44:19.147Z'
					}
				}
			},
			children
		});
		await expect
			.element(
				page
					.getByRole('navigation', { name: "Tierney's sites" })
					.getByRole('link', { name: 'tierney.camera' })
			)
			.toHaveAccessibleDescription('Newest photo: A Bushwick rooftop at dusk, Sep 17, 2026');
	});
});
