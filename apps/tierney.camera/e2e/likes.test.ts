import { expectNoViolations } from '@bnb/testing/a11y';
import { expect, test } from '@playwright/test';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const HEART = /^Like photograph \d{2}/;
const OPEN = /^Open photograph/;
const VIEWER = /photograph viewer/i;
const CONNECT_HTTPS = /connect-src [^;]*https:/;
const CALLBACK = /\/oauth\/callback\/$/;

test.describe('likes', () => {
	test('every photograph with a gallery has a heart, signed out', async ({ page }) => {
		await page.goto('/');
		const hearts = page.getByRole('button', { name: HEART });
		await expect(hearts.first()).toBeAttached({ timeout: 20_000 });
		for (const heart of await hearts.all()) {
			await expect(heart).toHaveAttribute('aria-pressed', 'false');
		}
	});

	test('liking asks a signed-out reader for their Atmosphere handle', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		const figure = page.locator('figure.shot').first();
		await figure.scrollIntoViewIfNeeded();
		await figure.getByRole('button', { name: HEART }).click();

		const dialog = page.getByRole('dialog', { name: 'Sign in to like' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('textbox', { name: 'Your handle' })).toBeFocused();
		await expectNoViolations(page, 'dialog');
		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect(dialog).toBeHidden();
	});

	test('the lightbox has the photograph’s heart, and signing in opens over it', async ({
		page
	}) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		await page.locator('figure.shot').first().getByRole('button', { name: OPEN }).click();
		const viewer = page.getByRole('dialog', { name: VIEWER });
		await viewer.getByRole('button', { name: HEART }).click();
		await expect(page.getByRole('dialog', { name: 'Sign in to like' })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog', { name: 'Sign in to like' })).toBeHidden();
		await expect(viewer).toBeVisible();
	});

	test('serves the OAuth client metadata, scoped to likes', async ({ request }) => {
		const response = await request.get('/oauth-client-metadata.json');
		expect(response.ok()).toBe(true);
		expect(await response.json()).toMatchObject({
			client_id: 'https://tierney.camera/oauth-client-metadata.json',
			redirect_uris: ['https://tierney.camera/oauth/callback/'],
			scope: 'atproto repo:social.grain.favorite?action=create&action=delete',
			dpop_bound_access_tokens: true
		});
	});

	test('the callback page lives at its registered address, and says when there’s nothing to finish', async ({
		page
	}) => {
		await page.goto('/oauth/callback');
		await expect(page).toHaveURL(CALLBACK);
		await expect(page.getByRole('status')).toHaveText("Couldn't finish signing in.");
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
		await expectNoViolations(page);
	});

	test('lets the page connect to readers’ servers', async ({ request }) => {
		const response = await request.get('/');
		expect(response.headers()['content-security-policy']).toMatch(CONNECT_HTTPS);
	});
});
