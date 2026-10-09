import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import SiteFooter from './SiteFooter.svelte';

describe('SiteFooter (component)', () => {
	it('signs off with a smile', async () => {
		const { container } = await render(SiteFooter);
		await expect.element(page.getByRole('contentinfo')).toHaveTextContent(':)');
		const signoff = container.querySelector('footer.site-footer p.signoff');
		expect(signoff?.textContent).toBe(':)');
		expect(signoff?.hasAttribute('aria-hidden')).toBe(false);
	});
});
