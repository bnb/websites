import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import ErrorPage from './+error.svelte';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const NOT_FOUND = /^Not Found/;
const SIDEWAYS = /^Something went sideways\./;

const state = vi.hoisted(() => ({
	page: { status: 404, error: { message: 'Not Found' } as { message: string } | null }
}));
vi.mock('$app/state', () => state);

describe('error page', () => {
	afterEach(() => {
		Object.assign(state.page, { status: 404, error: { message: 'Not Found' } });
	});

	it('shows the status and message, with a way back to the photographs', async () => {
		await render(ErrorPage);

		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('404');
		await expect.element(page.getByText(NOT_FOUND)).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Back to the photographs' }))
			.toHaveAttribute('href', '/');
		await expect
			.element(page.getByRole('link', { name: 'grain.social' }))
			.toHaveAttribute('href', 'https://grain.social/profile/bnb.im');
		expect(document.title).toBe('404 · tierney.camera');
	});

	it('has something to say when the error carries no message', async () => {
		Object.assign(state.page, { status: 500, error: null });
		await render(ErrorPage);

		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('500');
		await expect.element(page.getByText(SIDEWAYS)).toBeVisible();
		expect(document.title).toBe('500 · tierney.camera');
	});

	it('says plainly that there is no page at this address', async () => {
		const { container } = await render(ErrorPage);

		await expect
			.element(page.getByText('Nothing was shot here: there’s no page at this address.'))
			.toBeVisible();
		// the film edge numbers the blank frame with the status, out of the way of screen readers
		const edge = container.querySelector('.edge');
		expect(edge?.getAttribute('aria-hidden')).toBe('true');
		expect(edge?.textContent).toContain('▸ 404A');
	});

	it('owns up to a server error, and suggests trying again', async () => {
		Object.assign(state.page, { status: 500, error: { message: 'Internal Error' } });
		await render(ErrorPage);

		await expect
			.element(
				page.getByText('This frame didn’t develop: the server hit an error. Try again in a minute.')
			)
			.toBeVisible();
		await expect.element(page.getByRole('main')).toBeVisible();
	});
});
