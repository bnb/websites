import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import ErrorPage from './+error.svelte';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const SIDEWAYS = /^Something went sideways\./;
const NOT_FOUND = /^Not found/;

const state = vi.hoisted(() => ({
	page: { status: 404, error: { message: 'Not found' } as { message: string } | null }
}));
vi.mock('$app/state', () => state);

describe('error page', () => {
	afterEach(() => {
		Object.assign(state.page, { status: 404, error: { message: 'Not found' } });
	});

	it('shows the status and message, with a way back to the index', async () => {
		const { container } = await render(ErrorPage);

		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('404');
		await expect.element(page.getByText(NOT_FOUND)).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Back to the index' }))
			.toHaveAttribute('href', '/');
		// the layout already has the <main>
		expect(container.querySelector('main')).toBeNull();
		expect(document.title).toBe('404 · Tierney Cyren');
	});

	it('has something to say when the error carries no message', async () => {
		Object.assign(state.page, { status: 500, error: null });
		await render(ErrorPage);

		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('500');
		await expect.element(page.getByText(SIDEWAYS)).toBeVisible();
		expect(document.title).toBe('500 · Tierney Cyren');
	});
});
