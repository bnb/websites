import { expect, test } from '@playwright/test';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const OPEN = /^Open photograph/;
const HEART = /^Like photograph/;
const TITLE = /photography/i;
const VIEWER = /photograph viewer/i;
const NEXT_BUTTON = /next photograph/i;
const CLOSE_BUTTON = /close/i;
const FRAME = /^\d{2}$/;
const BACK_TO_TOP = /back to top/i;
const SCRIPT_HASH = /script-src [^;]*'sha256-/;
const NONCE = /nonce-/;
const EV_READING = /^EV -?\d+\.\d/;

test.describe('portfolio', () => {
	test('renders the masthead, the featured photograph and the grid', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(TITLE);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Featured photograph' })).toBeVisible();

		const figures = page.locator('figure.shot');
		await expect(figures.first()).toBeVisible({ timeout: 20_000 });
		expect(await figures.count()).toBeGreaterThan(0);

		await expect(page.getByRole('link', { name: BACK_TO_TOP })).toBeAttached();
		// AT Tags: the account, and a record for every photograph in the grid
		await expect(page.locator('meta[name="at:me"]')).toHaveAttribute(
			'content',
			'at://did:plc:uashgn65n5z7aqwk5cbuba5c'
		);
		expect(await page.locator('meta[name="at:alternate"]').count()).toBeGreaterThanOrEqual(
			await figures.count()
		);
	});

	test('opens the lightbox on the clicked frame, pages forward, and closes on Escape', async ({
		page
	}) => {
		await page.goto('/');

		const figure = page.locator('figure.shot').first();
		await expect(figure).toBeVisible({ timeout: 20_000 });
		const number = (await figure.locator('.n').textContent())?.trim() ?? '';
		expect(number).toMatch(FRAME);
		const total = await page.locator('figure').count();

		await figure.getByRole('button', { name: OPEN }).click();

		const dialog = page.getByRole('dialog', { name: VIEWER });
		await expect(dialog).toBeVisible();
		await expect(dialog).toBeFocused();
		await expect(dialog).toContainText(`${number} / `);
		await expect(dialog.getByRole('meter', { name: 'Light meter' })).toHaveAttribute(
			'aria-valuetext',
			EV_READING
		);

		// arrow keys page without dragging focus (or its ring) onto a control
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowLeft');
		await expect(dialog).toBeFocused();

		const next = String((Number(number) % total) + 1).padStart(2, '0');
		await page.getByRole('button', { name: NEXT_BUTTON }).click();
		await expect(dialog).toContainText(`${next} / `);

		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(figure.getByRole('button', { name: OPEN })).toBeFocused();
	});

	test('keeps keyboard focus inside the lightbox on a phone', async ({ page }) => {
		// below 760px the arrow buttons are hidden, leaving the heart and Close as the controls
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/');

		const figure = page.locator('figure.shot').first();
		await figure.scrollIntoViewIfNeeded();
		await figure.getByRole('button', { name: OPEN }).click();
		const dialog = page.getByRole('dialog', { name: VIEWER });
		await expect(dialog).toBeVisible();

		const heart = dialog.getByRole('button', { name: HEART });
		const close = dialog.getByRole('button', { name: CLOSE_BUTTON });
		for (const [key, focused] of [
			['Tab', heart],
			['Tab', close],
			['Tab', heart],
			['Shift+Tab', close]
		] as const) {
			await page.keyboard.press(key);
			await expect(focused).toBeFocused();
		}
	});

	test('shows the photographs even if the app bundle never loads', async ({ page }) => {
		await page.route('**/_app/immutable/**/*.js', (route) => route.abort());
		await page.goto('/');
		// the reveal hides figures until the app starts; app.html's fallback lifts it
		await expect(page.locator('figure.shot').first()).toHaveCSS('opacity', '1', {
			timeout: 8_000
		});
	});

	test('sends security headers and a hash-based CSP', async ({ request }) => {
		const response = await request.get('/');
		const headers = response.headers();
		const csp = headers['content-security-policy'];
		expect(csp).toContain("frame-ancestors 'none'");
		// the page is publicly cacheable, so the CSP mustn't rely on a per-response nonce
		expect(csp).toMatch(SCRIPT_HASH);
		expect(csp).not.toMatch(NONCE);
		expect(headers['strict-transport-security']).toContain('max-age=');
		expect(headers['x-content-type-options']).toBe('nosniff');
	});

	test('points Open Graph at a generated share card', async ({ page, request }) => {
		await page.goto('/');
		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
			'content',
			'https://tierney.camera/og.png'
		);

		const response = await request.get('/og.png');
		expect(response.headers()['content-type']).toBe('image/png');
		const png = await response.body();
		expect(png.readUInt32BE(16)).toBe(1200);
		expect(png.readUInt32BE(20)).toBe(630);
	});

	test('answers the health check', async ({ request }) => {
		const response = await request.get('/healthz');
		expect(response.ok()).toBe(true);
		expect(await response.text()).toBe('ok');
	});
});
