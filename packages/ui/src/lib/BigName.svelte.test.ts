import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import BigName from './BigName.svelte';

describe('BigName (component)', () => {
	it('sets each line on its own, keeping a readable accessible name', async () => {
		const { container } = await render(BigName, {
			lines: ['tierney', 'cyren'],
			accent: 'last',
			split: true
		});
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('tierney cyren');
		const last = container.querySelector('.last')!;
		expect(last.classList.contains('accent')).toBe(true);
		expect(getComputedStyle(last).textAlign).toBe('right');
	});

	it('links the heading and accents a trailing mark', async () => {
		const { container } = await render(BigName, {
			lines: ['Tierney', 'Cyren'],
			mark: '.',
			href: '/'
		});
		await expect.element(page.getByRole('link')).toHaveAttribute('href', '/');
		expect(container.querySelector('h1 a .mark')?.textContent).toBe('.');
		expect(container.querySelector('.accent')).toBeNull();
	});

	it('can be a plain link or paragraph instead of a heading', async () => {
		const link = await render(BigName, {
			lines: ['Tierney Cyren'],
			mark: '.',
			heading: false,
			href: '/'
		});
		expect(link.container.querySelector('a.big-name')).not.toBeNull();
		expect(link.container.querySelector('h1')).toBeNull();

		const plain = await render(BigName, { lines: ['tierney'], heading: false });
		expect(plain.container.querySelector('p.big-name')?.textContent).toBe('tierney');
	});
});
