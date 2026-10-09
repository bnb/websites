import type { ComponentProps } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import SeriesPage from './+page.svelte';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const LEDE = /^Stepping through various bits of developer experience/;

const state = vi.hoisted(() => ({
	page: { url: new URL('https://bnb.im/series/esm-in-node-js/') }
}));
vi.mock('$app/state', () => state);

type PageData = ComponentProps<typeof SeriesPage>['data'];

const data: PageData = {
	topics: [],
	atTags: [],
	latest: {},
	title: 'ESM in Node.js',
	description: 'Stepping through various bits of developer experience around ESM in Node.js.',
	rows: [
		{
			n: '01',
			title: 'Explicit ESM in Node.js with .mjs',
			url: '/posts/explicit/',
			date: '2021-06-16',
			year: '2021'
		},
		{
			n: '02',
			title: 'Implicit ESM in Node.js with &quot;type&quot;: &quot;module&quot;',
			url: '/posts/implicit/',
			date: '2021-06-16',
			year: '2021'
		}
	]
};

describe('series page', () => {
	it('lists the parts of the series', async () => {
		const { container } = await render(SeriesPage, { data });

		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('ESM in Node.js');
		await expect.element(page.getByText('A series in 2 parts')).toBeVisible();
		await expect.element(page.getByText(LEDE)).toBeVisible();
		await expect.element(page.getByRole('link', { name: '← Index' })).toHaveAttribute('href', '/');

		expect(Array.from(container.querySelectorAll('thead th'), (th) => th.textContent)).toEqual([
			'Part',
			'Title',
			'Year'
		]);
		await expect
			.element(page.getByRole('link', { name: 'Implicit ESM in Node.js with "type": "module"' }))
			.toHaveAttribute('href', '/posts/implicit/');
	});

	it("shares with the site's own title and card, at the series' URL", async () => {
		await render(SeriesPage, { data });
		expect(document.title).toBe('Tierney Cyren');
		const meta = (selector: string) =>
			document.head.querySelector(`meta[${selector}]`)?.getAttribute('content');
		expect(meta('property="og:url"')).toBe('https://bnb.im/series/esm-in-node-js/');
		expect(meta('property="og:image"')).toBe('https://bnb.im/img/small-card.png');
		expect(meta('name="twitter:card"')).toBe('summary');
	});
});
