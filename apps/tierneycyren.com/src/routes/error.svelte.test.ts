import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import ErrorPage from './+error.svelte';

const state = vi.hoisted(() => ({
	page: { status: 404, error: { message: 'Not Found' } as { message: string } | null }
}));
vi.mock('$app/state', () => state);

const NOT_FOUND = /Track not found: there’s no page at this address\./;
const NEEDLE_UP = /Needle up/;
const PDS_DOWN = /The PDS is down\./;

describe('error page', () => {
	it('shows the status and message, with a way back to the mixes', async () => {
		const { container } = await render(ErrorPage);
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('404');
		expect(container.querySelector('main')?.textContent).toMatch(NOT_FOUND);
		await expect
			.element(page.getByRole('link', { name: 'Back to the mixes' }))
			.toHaveAttribute('href', '/');
		expect(document.title).toBe('404 · tierney cyren');
	});

	it('has something to say when the error carries no message', async () => {
		Object.assign(state.page, { status: 500, error: null });
		const { container } = await render(ErrorPage);
		expect(container.querySelector('p')?.textContent).toContain('Something went sideways.');
	});

	it('passes on what went wrong for other errors', async () => {
		Object.assign(state.page, { status: 503, error: { message: 'The PDS is down.' } });
		const { container } = await render(ErrorPage);
		const text = container.querySelector('main')?.textContent;
		expect(text).toMatch(NEEDLE_UP);
		expect(text).toMatch(PDS_DOWN);
	});
});
