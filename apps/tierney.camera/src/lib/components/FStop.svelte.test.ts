import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FStop from './FStop.svelte';

describe('FStop (component)', () => {
	it('keeps ƒ lowercase inside uppercased text', async () => {
		const { container } = await render(FStop, { text: 'FE 50mm ƒ/1.4 GM' });
		container.style.textTransform = 'uppercase';

		expect(container.textContent).toBe('FE 50mm ƒ/1.4 GM');
		const hook = container.querySelector<HTMLElement>('.f');
		expect(hook && getComputedStyle(hook).textTransform).toBe('none');
	});

	it('passes text without ƒ through untouched', async () => {
		const { container } = await render(FStop, { text: 'ISO 12800' });
		expect(container.textContent).toBe('ISO 12800');
		expect(container.querySelector('.f')).toBeNull();
	});
});
