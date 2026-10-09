import { expectNoViolations } from '@bnb/testing/a11y';
import { test } from '@playwright/test';

const PAGES = [
	['the index', '/'],
	['a post with code', '/posts/the-new-npm-diff-command/'],
	['a post with a Bluesky embed', '/posts/what-is-the-atmosphere/'],
	['a post in a series', '/posts/conditional-exports-supporting-both-import-and-require/'],
	['the series page', '/series/esm-in-node-js/'],
	['the not-found page', '/404.html']
] as const;

const VIEWPORTS = [
	['a laptop', { width: 1280, height: 800 }],
	['a phone', { width: 390, height: 844 }]
] as const;

test.describe('accessibility', () => {
	for (const [name, path] of PAGES) {
		for (const [device, viewport] of VIEWPORTS) {
			test(`${name} has no axe violations on ${device}`, async ({ page }) => {
				await page.setViewportSize(viewport);
				await page.emulateMedia({ reducedMotion: 'reduce' });
				await page.goto(path);
				await expectNoViolations(page);
			});
		}
	}
});
