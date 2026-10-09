import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import SiteHeader from './SiteHeader.svelte';

const topics = ['AT Protocol', 'Node.js', 'GitHub Actions', 'npm', 'TC39'];

describe('SiteHeader (component)', () => {
	it('sets the name as the home page heading', async () => {
		await render(SiteHeader, { home: true, topics });
		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toHaveTextContent('Tierney Cyren.');
		await expect
			.element(heading.getByRole('link', { name: 'Tierney Cyren.' }))
			.toHaveAttribute('href', '/');
	});

	it('makes the name a small link on other pages, with no heading', async () => {
		const { container } = await render(SiteHeader, { topics });
		expect(container.querySelector('h1')).toBeNull();
		expect(container.querySelector('.name')?.classList.contains('small')).toBe(true);
		await expect
			.element(page.getByRole('link', { name: 'Tierney Cyren.' }))
			.toHaveAttribute('href', '/');
	});

	it('links the feed, and no social accounts', async () => {
		const { container } = await render(SiteHeader, { topics });
		await expect
			.element(page.getByRole('link', { name: 'RSS' }))
			.toHaveAttribute('href', 'https://bnb.im/feed.xml');
		expect(container.querySelector('.top')?.querySelectorAll('a')).toHaveLength(1);
	});

	it('runs the tagline and the topics through a pausable marquee', async () => {
		const { container } = await render(SiteHeader, { topics });
		await expect
			.element(page.getByRole('checkbox', { name: 'Pause the marquee' }))
			.toBeInTheDocument();

		const run = container.querySelector('.marquee .run');
		const items = Array.from(run?.querySelectorAll('span:not(.sep)') ?? [], (s) => s.textContent);
		// the tagline and five topics, twice over to fill a run of twelve
		const once = ['Software and selected garbage', ...topics];
		expect(items).toEqual([...once, ...once]);
		expect(run?.textContent).toContain('Software and selected garbage ✶ AT Protocol ✶ ');
	});

	it('shows just the tagline without topics', async () => {
		const { container } = await render(SiteHeader);
		const items = [...container.querySelectorAll('.marquee .run:first-child span:not(.sep)')];
		expect(new Set(items.map((s) => s.textContent))).toEqual(
			new Set(['Software and selected garbage'])
		);
		expect(container.querySelector('h1')).toBeNull();
	});
});
