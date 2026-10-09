import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import NotFound from './+page.svelte';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const NOTHING_HERE = /^There's nothing at this address\./;

describe('404 page', () => {
	it("says there's nothing here, and keeps itself out of search results", async () => {
		const { container } = await render(NotFound);

		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('404');
		await expect.element(page.getByText(NOTHING_HERE)).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Back to the index' }))
			.toHaveAttribute('href', '/');
		expect(container.querySelector('main')).toBeNull();
		expect(document.title).toBe('Not found · Tierney Cyren');
		expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
			'noindex'
		);
	});
});
