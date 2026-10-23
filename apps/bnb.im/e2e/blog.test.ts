import { expect, test } from '@playwright/test';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const CSP_DEFAULT = /default-src 'self'/;

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const SERIES_TAG = /^ESM in Node\.js \d\/3$/;
const ATOM_ENTRY = /<entry>/g;
const PNG_TYPE = /image\/png/;
const ATPROTO_URI = /^at:\/\/did:plc:[a-z0-9]+\/site\.standard\.document\/[a-z0-9]+$/;
const SUBSCRIBE_BUTTON = /subscribe/i;
const PAUSE = /pause the marquee/i;
const SKIP = /skip to content/i;

test.describe('bnb.im', () => {
	test('the index lists every post, newest first, with the big name', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle('Tierney Cyren');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tierney Cyren.');
		// a row per post (each year's heading row has no cells)
		const rows = page.locator('table.posts tbody tr:has(td)');
		await expect(rows).toHaveCount(14);
		await expect(rows.first().locator('.n')).toHaveText('14');
		await expect(rows.last().locator('.n')).toHaveText('01');
		await expect(page.locator('.series-tag')).toHaveCount(3);
		await expect(page.locator('.series-tag').first()).toHaveText(SERIES_TAG);
		await expect(page.getByRole('link', { name: 'RSS' })).toHaveAttribute(
			'href',
			'https://bnb.im/feed.xml'
		);
		await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
		await expect(page.locator('link[rel="alternate"]')).toHaveAttribute(
			'href',
			'https://bnb.im/feed.xml'
		);
		await expect(page.locator('meta[name="at:me"]')).toHaveCount(1);
	});

	test('a post has its meta strip, permalinks, record links and subscribe box', async ({
		page
	}) => {
		await page.goto('/posts/the-new-npm-diff-command/');
		await expect(page).toHaveTitle('The New npm diff Command');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('The New npm diff Command');

		const meta = page.locator('dl.facts');
		await expect(meta.locator('dt')).toHaveText(['Date', 'Read', 'Topic', 'Tags']);
		await expect(meta.locator('dd').first()).toHaveText('02.04.2021');

		const heading = page.locator('.prose h2#preface');
		await expect(heading.locator('a.direct-link')).toHaveAttribute('href', '#preface');
		await expect(
			page.locator('.prose pre.language-diff code .token.inserted').first()
		).toBeVisible();

		const record = await page.locator('link[rel="site.standard.document"]').getAttribute('href');
		expect(record).toMatch(ATPROTO_URI);
		await expect(page.locator('meta[name="at:canonical"]')).toHaveAttribute('content', record!);
		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
			'content',
			'https://bnb.im/img/social/the-new-npm-diff-command.png'
		);

		// the subscribe button is a web component that renders itself
		await expect(
			page.locator('standard-site-subscribe').getByRole('button', { name: SUBSCRIBE_BUTTON })
		).toBeVisible();
	});

	test('the index splits the posts by year, newest year first', async ({ page }) => {
		await page.goto('/');
		const years = page.locator('table.posts th[scope="rowgroup"]');
		await expect(years).toHaveText([
			'2026 2 posts',
			'2025 1 post',
			'2021 5 posts',
			'2020 2 posts',
			'2019 4 posts'
		]);
		await expect(
			page.locator('table.posts tbody').first().locator('td.year time').first()
		).toHaveText('02.10');
	});

	test('code blocks wear a language sticker', async ({ page }) => {
		await page.goto('/posts/the-new-npm-diff-command/');
		const figure = page.locator('.prose figure.code').first();
		await expect(figure.locator('figcaption .code-lang')).toHaveText('bash');
		await expect(figure.locator('pre.language-bash')).toBeVisible();
	});

	test('the reading progress bar fills with the scroll, unless motion is reduced', async ({
		page
	}) => {
		await page.goto('/posts/what-is-the-atmosphere/');
		const bar = page.locator('.progress');
		// without scroll-driven animations (Firefox) nothing would fill it, so it isn't shown
		if (!(await page.evaluate(() => CSS.supports('animation-timeline: scroll()')))) {
			await expect(bar).toBeHidden();
			return;
		}
		const scale = () => bar.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
		expect(await scale()).toBeLessThan(0.05);
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		await expect.poll(scale).toBeGreaterThan(0.95);

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(bar).toBeHidden();
	});

	test('prints as a two-column zine page without the chrome', async ({ page }) => {
		await page.goto('/posts/the-new-npm-diff-command/');
		await page.emulateMedia({ media: 'print' });
		await expect(page.locator('.prose')).toHaveCSS('column-count', '2');
		await expect(page.getByRole('navigation', { name: "Tierney's sites" })).toBeHidden();
		await expect(page.locator('.subscribe')).toBeHidden();
		await expect(page.locator('label.marquee')).toBeHidden();
		await expect(page.locator('.site-header .big-name')).toBeVisible();
		const after = await page
			.locator('.prose a[href^="https://registry.npmjs.com"]')
			.first()
			.evaluate((a) => getComputedStyle(a, '::after').content);
		expect(after).toContain('https://registry.npmjs.com');
	});

	test('the name and the marquee morph between pages while they are on screen', async ({
		page
	}) => {
		await page.goto('/');
		const name = page.locator('.site-header .big-name');
		const marquee = page.locator('label.marquee');
		await expect(name).toHaveCSS('view-transition-name', 'big-name');
		await expect(marquee).toHaveCSS('view-transition-name', 'marquee');
		// sitting out needs view timelines (not in Firefox), so there they always morph
		if (!(await page.evaluate(() => CSS.supports('animation-timeline: view()')))) return;
		// scrolled off the top, they'd fly in from nowhere, so they sit it out
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		await expect(name).toHaveCSS('view-transition-name', 'none');
		await expect(marquee).toHaveCSS('view-transition-name', 'none');
	});

	test('a series part links to its series page, which lists every part in order', async ({
		page
	}) => {
		await page.goto('/posts/implicit-esm-in-node-js-with-type-module/');
		await page.getByRole('link', { name: 'ESM in Node.js 2/3' }).click();
		await expect(page).toHaveURL('/series/esm-in-node-js/');
		await expect(page.locator('.kicker')).toHaveText('A series in 3 parts');
		await expect(page.locator('table.posts tbody .n')).toHaveText(['01', '02', '03']);
	});

	test('Bluesky links on their own line become static embeds', async ({ page }) => {
		await page.goto('/posts/what-is-the-atmosphere/');
		const embed = page.locator('blockquote.bsky-embed').first();
		await expect(embed).toBeVisible();
		await expect(embed.getByRole('link', { name: 'View on Bluesky' }).first()).toBeVisible();
	});

	test('pages ship no SvelteKit JavaScript', async ({ page }) => {
		const scripts: string[] = [];
		page.on('request', (request) => {
			if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
		});
		await page.goto('/');
		await page.goto('/posts/is-mdm/');
		expect(scripts.every((path) => path.startsWith('/standard-site/'))).toBe(true);
	});

	test('the marquee pauses without JavaScript, from its label or the keyboard', async ({
		browser
	}) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto('/');
		const track = page.locator('.track');
		await expect(track).toHaveCSS('animation-play-state', 'running');
		await page.locator('label.marquee').click();
		await expect(track).toHaveCSS('animation-play-state', 'paused');
		await expect(page.getByRole('checkbox', { name: PAUSE })).toBeChecked();
		await context.close();
	});

	test('the skip link is the first stop', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('Tab');
		await expect(page.getByRole('link', { name: SKIP })).toBeFocused();
	});

	test('serves the Atom feed', async ({ request }) => {
		const response = await request.get('/feed.xml');
		expect(response.ok()).toBe(true);
		const xml = await response.text();
		expect(xml).toContain('<subtitle>Software and Selected Garbage</subtitle>');
		expect(xml.match(ATOM_ENTRY)).toHaveLength(14);
		expect(xml).toContain(
			'href=&quot;https://bnb.im/posts/the-new-npm-diff-command/#preface&quot;'
		);
	});

	test('serves a social image for every post', async ({ request }) => {
		const response = await request.get('/img/social/is-mdm.png');
		expect(response.ok()).toBe(true);
		expect(response.headers()['content-type']).toMatch(PNG_TYPE);
	});

	test('serves the standard.site files', async ({ request }) => {
		const wellKnown = await request.get('/.well-known/site.standard.publication');
		expect(await wellKnown.text()).toBe(
			'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.publication/3mtxb2uyta22l'
		);
		const metadata = await (await request.get('/oauth-client-metadata.json')).json();
		expect(metadata.redirect_uris).toEqual(['https://bnb.im/oauth/callback/']);
		const callback = await request.get('/oauth/callback/');
		expect(await callback.text()).toContain('data-standard-site-callback');
		expect((await request.get('/standard-site/subscribe.js')).ok()).toBe(true);
	});

	test('a missing page is a 404', async ({ page }) => {
		const response = await page.goto('/no-such-page/');
		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('404');
		await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
	});

	test('the static 404 page exists for GitHub Pages', async ({ request }) => {
		const response = await request.get('/404.html');
		expect(response.ok()).toBe(true);
		expect(await response.text()).toContain('Back to the index');
	});

	test('pages carry a Content-Security-Policy', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveAttribute(
			'content',
			CSP_DEFAULT
		);
	});
});
