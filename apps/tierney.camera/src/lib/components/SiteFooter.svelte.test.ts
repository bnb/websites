import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import SiteFooter from './SiteFooter.svelte';

/** The <dd> for a fact's term, e.g. "Based". */
function fact(container: HTMLElement, term: string): HTMLElement | undefined {
	const dt = [...container.querySelectorAll('dt')].find((el) => el.textContent === term);
	return dt?.nextElementSibling as HTMLElement | undefined;
}

describe('SiteFooter (component)', () => {
	it('lists where she is based and the kit she shoots with', async () => {
		const { container } = await render(SiteFooter, {
			name: 'tierney cyren',
			kit: ['Sony α7R IV', 'FE 50mm ƒ/1.4 GM']
		});

		expect(fact(container, 'Based')?.textContent).toBe('New York City');
		const kit = fact(container, 'Kit')!;
		expect(kit.textContent).toBe('Sony α7R IVFE 50mm ƒ/1.4 GM');
		expect(kit.querySelectorAll('br')).toHaveLength(1);
		// set in capitals, but the ƒ stays lowercase rather than becoming a hooked Ƒ
		expect(kit.innerText.split('\n')).toEqual(['SONY Α7R IV', 'FE 50MM ƒ/1.4 GM']);
	});

	it('leaves the kit out when no photograph names any', async () => {
		const { container } = await render(SiteFooter, { name: 'tierney cyren' });
		expect(fact(container, 'Kit')).toBeUndefined();
		expect(fact(container, 'Based')).toBeDefined();
	});

	it('links no social accounts', async () => {
		const { container } = await render(SiteFooter, { name: 'tierney cyren' });
		expect(fact(container, 'Elsewhere')).toBeUndefined();
		expect(container.querySelector('.facts a')).toBeNull();
	});

	it('signs off with the year, her name and a way back to the top', async () => {
		const { container } = await render(SiteFooter, { name: 'tierney cyren' });

		await expect
			.element(page.getByText(`© ${new Date().getFullYear()} tierney cyren`))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Back to top' }))
			.toHaveAttribute('href', '#top');
		// the giant sign-off is decoration
		const signoff = container.querySelector('.signoff');
		expect(signoff?.textContent).toBe('tierney.camera');
		expect(signoff?.getAttribute('aria-hidden')).toBe('true');
		await expect.element(page.getByRole('contentinfo')).toBeInTheDocument();
	});
});
