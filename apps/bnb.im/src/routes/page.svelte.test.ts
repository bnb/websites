import type { ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Page from './+page.svelte';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const INTRO = /^I'm Tierney Cyren - Developer Advocate/;

type PageData = ComponentProps<typeof Page>['data'];

const data: PageData = {
	topics: ['AT Protocol'],
	atTags: [],
	latest: {},
	rows: [
		{
			n: '02',
			title: 'What is the Atmosphere: An Untech Introduction',
			url: '/posts/what-is-the-atmosphere/',
			topic: 'AT Protocol',
			date: '2026-10-02',
			year: '2026'
		},
		{
			n: '01',
			title: 'Jest and the <code>--changedSince</code> flag',
			url: '/posts/jest/',
			topic: 'GitHub Actions',
			date: '2020-04-09',
			year: '2020'
		}
	]
};

const meta = (selector: string) =>
	document.head.querySelector(`meta[${selector}]`)?.getAttribute('content');

describe('index page', () => {
	it('introduces the author, then lists the writing', async () => {
		const { container } = await render(Page, { data });

		await expect.element(page.getByRole('heading', { name: 'Who?' })).toBeVisible();
		await expect.element(page.getByText(INTRO)).toBeVisible();
		await expect
			.element(page.getByRole('region', { name: 'Writing' }).getByRole('table'))
			.toBeVisible();
		// a row per post; each year's heading row isn't one
		expect(container.querySelectorAll('tbody tr:has(td)')).toHaveLength(2);
		await expect
			.element(page.getByRole('link', { name: 'What is the Atmosphere: An Untech Introduction' }))
			.toHaveAttribute('href', '/posts/what-is-the-atmosphere/');
	});

	it("uses the site's title and small card for sharing", async () => {
		await render(Page, { data });
		expect(document.title).toBe('Tierney Cyren');
		expect(meta('name="description"')).toBe(
			'On JavaScript, Node.js Software, Standards, and real life.'
		);
		expect(meta('property="og:url"')).toBe('https://bnb.im/');
		expect(meta('property="og:image"')).toBe('https://bnb.im/img/small-card.png');
		expect(meta('name="twitter:image"')).toBe('https://bnb.im/img/small-card.png');
		expect(meta('name="twitter:card"')).toBe('summary');
		expect(meta('name="twitter:creator"')).toBe('@bitandbang');
	});
});
