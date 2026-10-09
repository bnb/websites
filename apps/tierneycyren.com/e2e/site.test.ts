import { expect, test } from '@playwright/test';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const TITLE = /tierney cyren · dj/;
const SCRIPT_HASH = /script-src [^;]*'self'/;
const MEDIA = /media-src 'self' https:/;
const SKIP = /skip to the mixes/i;
const MIXES_HASH = /#mixes$/;
const CARD = /^https:\/\/tierneycyren\.com\/og\.png/;

test.describe('tierneycyren.com', () => {
	test('renders the name, the marquee and the mixes from plyr.fm records', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(TITLE);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('tierney cyren');
		await expect(page.getByRole('checkbox', { name: 'Pause the ticker' })).toBeAttached();

		const mixes = page.locator('#mixes article');
		await expect(mixes.first()).toBeVisible({ timeout: 20_000 });
		expect(await mixes.count()).toBeGreaterThan(0);
		// nothing streams until someone presses play
		await expect(mixes.first().locator('audio')).toHaveAttribute('preload', 'none');
		await expect(page.getByRole('link', { name: 'Back to top' })).toBeAttached();
		// AT Tags: the account, and a record for every mix
		await expect(page.locator('meta[name="at:me"]')).toHaveAttribute(
			'content',
			'at://did:plc:uashgn65n5z7aqwk5cbuba5c'
		);
		expect(await page.locator('meta[name="at:alternate"]').count()).toBeGreaterThanOrEqual(
			await mixes.count()
		);
	});

	test('the skip link is the first stop and jumps to the mixes', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('Tab');
		const skip = page.getByRole('link', { name: SKIP });
		await expect(skip).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(MIXES_HASH);
	});

	test('sends security headers and a CSP that allows the audio CDN', async ({ request }) => {
		const response = await request.get('/');
		const headers = response.headers();
		const csp = headers['content-security-policy'];
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).toMatch(SCRIPT_HASH);
		expect(csp).toMatch(MEDIA);
		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['cache-control']).toContain('s-maxage=300');
	});

	test('serves the share card the page points to', async ({ page, request }) => {
		await page.goto('/');
		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', CARD);
		const response = await request.get('/og.png');
		expect(response.headers()['content-type']).toBe('image/png');
		const png = await response.body();
		// the PNG signature, then a 1200×630 IHDR
		expect(png.subarray(1, 4).toString()).toBe('PNG');
		expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
	});

	test('playing a mix brings up the now-playing bar and the lock-screen details', async ({
		page
	}) => {
		await page.goto('/');
		const first = page.locator('#mixes article').first();
		await expect(first).toBeVisible({ timeout: 20_000 });
		const title = await first.getByRole('heading', { level: 3 }).textContent();
		// a real click gives the page a user gesture, as pressing play would
		await page.getByRole('heading', { level: 2, name: 'Mixes' }).click();
		await first.locator('audio').evaluate((audio: HTMLAudioElement) => audio.play());

		const bar = page.getByRole('region', { name: 'Now playing' });
		await expect(bar.getByRole('button', { name: `Pause ${title}` })).toBeVisible({
			timeout: 20_000
		});
		expect(await page.evaluate(() => navigator.mediaSession.metadata?.title)).toBe(title);
		await bar.getByRole('button', { name: `Pause ${title}` }).click();
		await expect(bar.getByRole('button', { name: `Play ${title}` })).toBeVisible();
	});

	test('answers the health check', async ({ request }) => {
		const response = await request.get('/healthz');
		expect(await response.text()).toBe('ok');
	});

	test('a missing page is a 404', async ({ page }) => {
		const response = await page.goto('/no-such-page');
		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('404');
	});
});
