import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SiteFooter from './SiteFooter.svelte';

vi.mock('../site', async (original) => ({
	...(await original<typeof import('../site')>()),
	BOOKING_EMAIL: 'booking@example.com'
}));

describe('SiteFooter with a booking address', () => {
	it('leads with a mailto link', async () => {
		const { container } = await render(SiteFooter, {});
		expect(container.querySelector('dt')?.textContent).toBe('Booking');
		expect(container.querySelector('dd a')?.getAttribute('href')).toBe(
			'mailto:booking@example.com'
		);
	});
});
