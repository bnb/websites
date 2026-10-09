import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import GarbageStatus from './GarbageStatus.svelte';

const back = createRawSnippet(() => ({ render: () => '<a href="/">Back to the index</a>' }));

describe('GarbageStatus', () => {
	it('heads the page with the status, still readable as one word', async () => {
		const { container } = await render(GarbageStatus, {
			status: 404,
			message: "There's nothing at this address.",
			children: back
		});
		await expect.element(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
		expect(container.querySelector('h1')?.textContent).toBe('404');
		expect(container.querySelectorAll('h1 .digit')).toHaveLength(3);
		await expect.element(page.getByText("There's nothing at this address.")).toBeVisible();
		await expect.element(page.getByText('Selected garbage')).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Back to the index' }))
			.toHaveAttribute('href', '/');
	});

	it('drops each digit at a different angle', async () => {
		const { container } = await render(GarbageStatus, { status: 500, message: 'Oops.' });
		// once they've landed
		await Promise.all(document.getAnimations().map((animation) => animation.finished));
		const angles = Array.from(
			container.querySelectorAll<HTMLElement>('.digit'),
			(digit) => getComputedStyle(digit).rotate
		);
		expect(new Set(angles).size).toBe(3);
		expect(angles).not.toContain('none');
	});

	it("leaves the links out when there aren't any", async () => {
		const { container } = await render(GarbageStatus, { status: 500, message: 'Oops.' });
		expect(container.querySelector('.next')).toBeNull();
	});
});
