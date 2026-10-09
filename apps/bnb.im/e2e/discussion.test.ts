import { expectNoViolations } from '@bnb/testing/a11y';
import { expect, test, type Page } from '@playwright/test';

// The upvote button and the comments on a post, against stand-ins for
// Constellation and Slingshot, so every run sees the same thread.

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const CONSTELLATION = /^https:\/\/constellation\.microcosm\.blue\//;
const SLINGSHOT = /^https:\/\/slingshot\.microcosm\.blue\//;
const UPVOTE = /^Upvote/;

const POST = '/posts/what-is-the-atmosphere/';
const DOCUMENT = 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.document/3mwwg6sy4e32e';
const ALICE = 'did:plc:alice';
const BOB = 'did:plc:bob';
const FIRST = `at://${ALICE}/at.upvote.comment/3kfirst`;

interface Comment {
	did: string;
	rkey: string;
	subject: string;
	text: string;
	createdAt: string;
}

const THREAD: Comment[] = [
	{
		did: ALICE,
		rkey: '3kfirst',
		subject: DOCUMENT,
		text: 'The **email analogy** finally landed for me.',
		createdAt: '2026-10-03T09:00:00.000Z'
	},
	{
		did: BOB,
		rkey: '3kreply',
		subject: FIRST,
		text: 'Same here. Sent it to [my team](https://example.com).',
		createdAt: '2026-10-03T10:00:00.000Z'
	}
];

/** Answers Constellation and Slingshot from `comments` and one upvote, unless `fail` says otherwise. */
async function standIns(page: Page, { comments = THREAD, fail = false } = {}) {
	await page.route(CONSTELLATION, (route) => {
		if (fail) return route.fulfill({ status: 503, body: '' });
		const url = new URL(route.request().url());
		const target = url.searchParams.get('target');
		if (url.pathname === '/links/count')
			return route.fulfill({ json: { total: target === DOCUMENT ? 1 : 0 } });
		if (url.searchParams.get('collection') === 'at.upvote.signal') {
			return route.fulfill({ json: { total: 0, linking_records: [], cursor: null } });
		}
		const links = comments
			.filter((comment) => comment.subject === target)
			.map(({ did, rkey }) => ({ did, collection: 'at.upvote.comment', rkey }));
		return route.fulfill({ json: { total: links.length, linking_records: links, cursor: null } });
	});
	await page.route(SLINGSHOT, (route) => {
		const url = new URL(route.request().url());
		if (url.pathname.endsWith('resolveMiniDoc')) {
			const did = url.searchParams.get('identifier')!;
			return route.fulfill({
				json: {
					did,
					handle: did === ALICE ? 'alice.example' : 'bob.example',
					pds: 'https://pds.example'
				}
			});
		}
		const comment = comments.find(({ rkey }) => rkey === url.searchParams.get('rkey'))!;
		return route.fulfill({
			json: {
				uri: `at://${comment.did}/at.upvote.comment/${comment.rkey}`,
				cid: 'cid',
				value: { $type: 'at.upvote.comment', ...comment }
			}
		});
	});
}

test.describe('upvotes and comments', () => {
	test('a post has its upvote count and its comments, threaded', async ({ page }) => {
		await standIns(page);
		await page.goto(POST);
		const upvote = page.getByRole('button', { name: UPVOTE });
		await expect(upvote).toHaveAccessibleName('Upvote, 1 upvote');
		await expect(upvote).toHaveAttribute('aria-pressed', 'false');

		const comments = page.getByRole('region', { name: 'Comments' });
		const articles = comments.getByRole('article');
		await expect(articles).toHaveCount(2);
		await expect(articles.first()).toContainText('@alice.example');
		await expect(articles.first().locator('strong')).toHaveText('email analogy');
		await expect(articles.nth(1)).toContainText('@bob.example');
		await expect(articles.nth(1).getByRole('link', { name: 'my team' })).toHaveAttribute(
			'rel',
			'nofollow ugc noopener noreferrer'
		);
		await expect(
			comments.getByRole('button', { name: 'Sign in with your Atmosphere account to comment' })
		).toBeVisible();
	});

	test('the post, its upvote and its comments have no axe violations', async ({ page }) => {
		await standIns(page);
		await page.goto(POST);
		await expect(page.getByRole('region', { name: 'Comments' }).getByRole('article')).toHaveCount(
			2
		);
		await expectNoViolations(page);
	});

	test('signing in to upvote opens over the page, and has no axe violations', async ({ page }) => {
		await standIns(page);
		await page.goto(POST);
		await page.getByRole('button', { name: UPVOTE }).click();
		const dialog = page.getByRole('dialog', { name: 'Sign in' });
		await expect(dialog.getByRole('textbox', { name: 'Your handle' })).toBeFocused();
		await expectNoViolations(page, 'dialog');
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(page.getByRole('button', { name: UPVOTE })).toBeFocused();
	});

	test('says when there are no comments yet', async ({ page }) => {
		await standIns(page, { comments: [] });
		await page.goto(POST);
		await expect(page.getByText('No comments yet.')).toBeVisible();
	});

	test('says when the comments can’t load, and the upvote shows no count', async ({ page }) => {
		await standIns(page, { fail: true });
		await page.goto(POST);
		await expect(page.getByText("Couldn't load the comments.")).toBeVisible();
		await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
		await expect(page.getByRole('button', { name: UPVOTE })).toHaveAccessibleName('Upvote');
	});

	test('loads the upvote and comments script under the page’s CSP, once', async ({ page }) => {
		const blocked: string[] = [];
		page.on('console', (message) => {
			if (message.text().includes('Content Security Policy')) blocked.push(message.text());
		});
		await standIns(page);
		await page.goto(POST);
		await expect(page.getByRole('button', { name: UPVOTE })).toBeVisible();
		await expect(page.locator('script[src="/standard-site/discussion.js"]')).toHaveCount(1);
		expect(blocked).toEqual([]);
	});
});

// Chromium with JavaScript switched off still parses <noscript> as text, so
// this is a reader without JavaScript as a browser without it would show the
// page: the script never runs, and each <noscript>'s content is part of it.
test('without JavaScript, says comments need it, and shows no upvote or ghost lines', async ({
	page
}) => {
	await page.route('**/standard-site/discussion.js', (route) => route.abort());
	await page.goto(POST);
	await page.evaluate(() => {
		for (const noscript of document.querySelectorAll('noscript')) {
			noscript.outerHTML = noscript.textContent ?? '';
		}
	});
	const comments = page.getByRole('region', { name: 'Comments' });
	await expect(comments.getByText('Comments need JavaScript.')).toBeVisible();
	await expect(comments.locator('.ghost')).toBeHidden();
	await expect(page.locator('.upvote')).toBeHidden();
});
