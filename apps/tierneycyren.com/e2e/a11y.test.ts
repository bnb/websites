import { expectNoViolations } from '@bnb/testing/a11y';
import { test } from '@playwright/test';

const VIEWPORTS = [
	['a laptop', { width: 1280, height: 800 }],
	['a phone', { width: 390, height: 844 }]
] as const;

test.describe('accessibility', () => {
	for (const [device, viewport] of VIEWPORTS) {
		test(`the page has no axe violations on ${device}`, async ({ page }) => {
			await page.setViewportSize(viewport);
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.goto('/');
			await page.locator('#mixes article').first().waitFor({ timeout: 20_000 });
			await expectNoViolations(page);
		});
	}

	test('the not-found page has no axe violations', async ({ page }) => {
		await page.goto('/no-such-page');
		await expectNoViolations(page);
	});
});
