import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Subscribe from './Subscribe.svelte';

const publication = 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.publication/3mtxb2uyta22l';
// an inline module stands in for the standard.site bundle
const script = 'data:text/javascript,';

describe('Subscribe (component)', () => {
	it('invites readers to follow new posts', async () => {
		await render(Subscribe, { publication, script });
		await expect
			.element(page.getByRole('complementary'))
			.toHaveTextContent('Want more garbage? Follow new posts as they land.');
		await expect
			.element(page.getByRole('heading', { level: 2, name: 'Want more garbage?' }))
			.toBeInTheDocument();
	});

	it("holds standard.site's subscribe button for the publication, and loads its script", async () => {
		const { container } = await render(Subscribe, { publication, script });
		const button = container.querySelector('aside.subscribe standard-site-subscribe');
		expect(button?.getAttribute('publication')).toBe(publication);

		const tag = container.querySelector('aside.subscribe script');
		expect(tag?.getAttribute('type')).toBe('module');
		expect(tag?.getAttribute('src')).toBe(script);
	});
});
