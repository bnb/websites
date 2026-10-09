import { expectNoViolations } from '@bnb/testing/a11y';
import { expect, test, type Page } from '@playwright/test';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const OPEN = /^Open photograph/;
const VIEWER = /photograph viewer/i;
const SKIP_LINK = /skip to photographs/i;
const WORK_HASH = /#work$/;

/**
 * Loads the portfolio and brings every photograph in. Figures fade in as they
 * scroll into view, and axe skips anything at opacity 0, so without this the
 * captions below the fold would never be checked for contrast.
 */
async function loadPortfolio(page: Page) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	const figures = page.locator('figure.shot');
	await expect(figures.first()).toBeVisible({ timeout: 20_000 });
	for (const figure of await figures.all()) await figure.scrollIntoViewIfNeeded();
	await expect(page.locator('figure.shot:not(.in)')).toHaveCount(0);
	await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe('accessibility', () => {
	test('the portfolio has no axe violations on a laptop', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await loadPortfolio(page);
		await expectNoViolations(page);
	});

	test('the portfolio has no axe violations on a phone', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await loadPortfolio(page);
		await expectNoViolations(page);
	});

	test('the open lightbox has no axe violations', async ({ page }) => {
		await loadPortfolio(page);
		await page.locator('figure.shot').first().getByRole('button', { name: OPEN }).click();
		await expect(page.getByRole('dialog', { name: VIEWER })).toBeVisible();
		await expectNoViolations(page, 'dialog');
	});

	test('the not-found page has no axe violations', async ({ page }) => {
		const response = await page.goto('/no-such-page');
		expect(response?.status()).toBe(404);
		await expectNoViolations(page);
	});

	test('the skip link is the first stop and jumps to the photographs', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('Tab');
		const skip = page.getByRole('link', { name: SKIP_LINK });
		await expect(skip).toBeFocused();
		await expect(skip).toBeInViewport();

		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(WORK_HASH);
		// the next Tab lands on the first photograph in the grid, not back in the masthead
		await page.keyboard.press('Tab');
		await expect(page.locator('#work figure.shot button').first()).toBeFocused();
	});
});
