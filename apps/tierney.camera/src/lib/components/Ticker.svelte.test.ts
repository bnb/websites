import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Ticker from './Ticker.svelte';

describe('Ticker (component)', () => {
	it('runs the items through the shared marquee, keeping every ƒ lowercase', async () => {
		const { container } = await render(Ticker, {
			items: ['Bushwick', 'FE 50mm ƒ/1.4 GM', 'ISO 12800']
		});

		const run = container.querySelector('.run')!;
		expect(run.textContent).toContain('Bushwick/FE 50mm ƒ/1.4 GM/ISO 12800/');
		const hooks = run.querySelectorAll('.f');
		expect(hooks.length).toBeGreaterThan(0);
		expect(getComputedStyle(hooks[0]).textTransform).toBe('none');
	});

	it('can be paused, and hides its decorative text from assistive tech', async () => {
		const { container } = await render(Ticker, { items: ['Bushwick'] });

		await expect
			.element(page.getByRole('checkbox', { name: 'Pause the ticker' }))
			.toBeInTheDocument();
		expect(container.querySelector('.track')?.getAttribute('aria-hidden')).toBe('true');
	});
});
