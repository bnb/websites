import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import Marquee from './Marquee.svelte';

const playState = (container: HTMLElement) =>
	getComputedStyle(container.querySelector('.track')!).animationPlayState;

describe('Marquee (component)', () => {
	it('pauses from the keyboard via its focus-revealed checkbox', async () => {
		const { container } = await render(Marquee, { items: ['Bushwick', 'Sony α7R IV'] });
		const toggle = page.getByRole('checkbox', { name: 'Pause the ticker' });
		// The pointer starts in the frame's top-left corner, over the band, which Chromium on Linux
		// counts as hovering it: that pauses it too. Moved off so only the checkbox decides.
		await userEvent.unhover(container.querySelector('.marquee')!);

		await userEvent.tab();
		await expect.element(toggle).toHaveFocus();
		await userEvent.keyboard(' ');
		await expect.element(toggle).toBeChecked();
		expect(playState(container)).toBe('paused');

		await userEvent.keyboard(' ');
		await expect.element(toggle).not.toBeChecked();
		expect(playState(container)).toBe('running');
	});

	it('pauses on a click or tap anywhere on the band', async () => {
		const { container } = await render(Marquee, { items: ['Bushwick'] });
		const band = container.querySelector<HTMLElement>('.marquee')!;

		await page.elementLocator(band.querySelector('.track')!).click({ force: true });
		await expect.element(page.getByRole('checkbox')).toBeChecked();
		// the band's text is decorative; only the control is exposed
		expect(band.querySelector('.track')?.getAttribute('aria-hidden')).toBe('true');
	});

	it('repeats the items to fill a run, twice, with the separator after each', async () => {
		const { container } = await render(Marquee, {
			items: ['a', 'b', 'c'],
			separator: ' ✶ ',
			fill: 7,
			label: 'the marquee'
		});
		const runs = container.querySelectorAll('.run');
		expect(runs).toHaveLength(2);
		// ceil(7 / 3) = 3 repeats of three items
		expect(runs[0].textContent).toBe('a ✶ b ✶ c ✶ '.repeat(3));
		expect(runs[1].textContent).toBe(runs[0].textContent);
		await expect
			.element(page.getByRole('checkbox', { name: 'Pause the marquee' }))
			.toBeInTheDocument();
	});

	it('copes with no items', async () => {
		const { container } = await render(Marquee, { items: [] });
		expect(container.querySelectorAll('.run')).toHaveLength(2);
		expect(container.querySelector('.run')?.textContent).toBe('');
	});

	it('renders items through a snippet', async () => {
		const item = createRawSnippet((value: () => string) => ({ render: () => `<b>${value()}</b>` }));
		const { container } = await render(Marquee, { items: ['ƒ/1.4'], item });
		expect(container.querySelector('.run b')?.textContent).toBe('ƒ/1.4');
	});
});
