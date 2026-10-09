import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { client, resetClient } from '@bnb/atmosphere/testing/oauth-client';
import { fakeRepo } from '@bnb/atmosphere/testing/repo';
import { commentUri, fakeAtmosphere, type FakeComment } from '../test/atmosphere';
import './discussion';

vi.mock('@atproto/oauth-client-browser', () => import('@bnb/atmosphere/testing/oauth-client'));

const POST = 'at://did:plc:author/site.standard.document/3lpost';
const READER = 'did:plc:reader';
const ALICE = 'did:plc:alice';
const BOB = 'did:plc:bob';
const COMMENT = 'at.upvote.comment';
// Regexes hoisted to module scope (e18e/prefer-static-regex).
const YOUR_REPLY = /^Your reply/;
const HANDLES = { [ALICE]: 'alice.example', [BOB]: 'bob.example', [READER]: 'reader.example' };

const at = (minute: number) => `2026-10-09T12:${String(minute).padStart(2, '0')}:00.000Z`;
const comment = (rkey: string, extra: Partial<FakeComment> = {}): FakeComment => ({
	did: ALICE,
	rkey,
	subject: POST,
	text: `comment ${rkey}`,
	createdAt: at(1),
	...extra
});

beforeEach(() => {
	resetClient();
	window.localStorage.clear();
	window.sessionStorage.clear();
	document.body.innerHTML = '';
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** The element, as a post page renders it: ghost lines inside while it loads. */
function comments(hide = '') {
	document.body.innerHTML = `<section aria-label="Comments"><standard-site-comments subject="${POST}" hide="${hide}"><p class="ghost">Loading</p></standard-site-comments></section>`;
	return document.querySelector('standard-site-comments')!;
}

/** Each shown comment's author and text, in order, indented by depth. */
const thread = () =>
	Array.from(document.querySelectorAll('.standard-site-comment > article'), (article) => {
		let level = 0;
		for (let node = article.parentElement!.parentElement; node; node = node.parentElement) {
			if (node.matches('.standard-site-comment')) level++;
		}
		const author = article.querySelector('.standard-site-author')!.textContent;
		const text = article.querySelector('.standard-site-body')!.textContent!.trim();
		return `${'  '.repeat(level)}${author}: ${text}`;
	});

/** A comment's article, by its author's handle (its name goes on with the date). */
const article = (handle: string) => page.getByRole('article', { name: new RegExp(`^@${handle} `) });

const loaded = () => vi.waitFor(() => expect(document.querySelector('.ghost')).toBeNull());

function returning(repo = fakeRepo({ did: READER })) {
	window.localStorage.setItem('standard-site:did', READER);
	client.restore.mockResolvedValue(repo.session);
	return repo;
}

const written = (repo: ReturnType<typeof fakeRepo>) =>
	(repo.records[COMMENT] ?? []).map((record) => record.value);

describe('<standard-site-comments>: reading', () => {
	it('keeps the page’s ghost lines up while it loads, then shows the comments oldest first', async () => {
		const world = fakeAtmosphere({
			handles: HANDLES,
			comments: [
				comment('3kb', { did: BOB, createdAt: at(5), text: 'second' }),
				comment('3ka', { createdAt: at(2), text: 'first' })
			]
		});
		const release = world.hold((url) => url.pathname === '/links');
		comments();
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(document.querySelector('.ghost')).not.toBeNull();
		release();
		await loaded();
		expect(thread()).toEqual(['@alice.example: first', '@bob.example: second']);
		const first = page.getByRole('article', { name: '@alice.example Oct 9, 2026' });
		await expect.element(first).toBeVisible();
		await expect
			.element(first.getByRole('time'))
			.toHaveAttribute('datetime', '2026-10-09T12:02:00.000Z');
	});

	it('renders Markdown safely: no raw HTML, no images, links that open apart', async () => {
		fakeAtmosphere({
			handles: HANDLES,
			comments: [
				comment('3ka', {
					text: '**bold** <img src=x onerror="alert(1)"> [site](https://example.com) ![pic](https://example.com/p.png) https://bare.example\n\n# not a heading\n\n[js](javascript:alert(1))'
				})
			]
		});
		comments();
		await loaded();
		const body = document.querySelector('.standard-site-body')!;
		expect(body.querySelector('strong')!.textContent).toBe('bold');
		expect(body.querySelector('img')).toBeNull();
		expect(body.querySelector('h1')).toBeNull();
		expect(body.textContent).toContain('<img src=x onerror="alert(1)">');
		const links = [...body.querySelectorAll('a')];
		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			'https://example.com',
			'https://example.com/p.png',
			'https://bare.example'
		]);
		for (const link of links) {
			expect(link.rel).toBe('nofollow ugc noopener noreferrer');
			expect(link.target).toBe('_blank');
		}
	});

	it('says when there are none', async () => {
		fakeAtmosphere();
		comments();
		await expect.element(page.getByText('No comments yet.')).toBeVisible();
		await expect
			.element(
				page.getByRole('button', { name: 'Sign in with your Atmosphere account to comment' })
			)
			.toBeVisible();
		await expect.element(page.getByRole('list')).not.toBeVisible();
	});

	it('says when it can’t load them, and tries again', async () => {
		const world = fakeAtmosphere({ handles: HANDLES, comments: [comment('3ka')] });
		world.fail = (url) => (url.pathname === '/links' ? new Response('', { status: 502 }) : null);
		comments();
		await expect.element(page.getByText("Couldn't load the comments.")).toBeVisible();
		world.fail = () => null;
		await page.getByRole('button', { name: 'Try again' }).click();
		await vi.waitFor(() => expect(thread()).toEqual(['@alice.example: comment 3ka']));
	});

	it('threads replies under what they reply to, four levels deep', async () => {
		const chain = ['3k1', '3k2', '3k3', '3k4', '3k5'].map((rkey, n, all) =>
			comment(rkey, {
				did: n % 2 ? BOB : ALICE,
				subject: n ? commentUri({ did: n % 2 ? ALICE : BOB, rkey: all[n - 1] }) : POST,
				createdAt: at(n + 1)
			})
		);
		const world = fakeAtmosphere({ handles: HANDLES, comments: chain });
		comments();
		await vi.waitFor(() => expect(thread()).toHaveLength(4));
		expect(thread()).toEqual([
			'@alice.example: comment 3k1',
			'  @bob.example: comment 3k2',
			'    @alice.example: comment 3k3',
			'      @bob.example: comment 3k4'
		]);
		// the fourth level's replies aren't looked for, and can't be replied to
		const listed = world.requests.filter((url) => url.pathname === '/links');
		expect(listed.map((url) => url.searchParams.get('target'))).not.toContain(
			commentUri({ did: BOB, rkey: '3k4' })
		);
		// the second level's comment by Bob can be replied to; the fourth level's can't
		const replies = page.getByRole('button', { name: 'Reply to @bob.example' });
		await expect.element(replies).toBeVisible();
		expect(replies.elements()).toHaveLength(1);
	});

	it('leaves out hidden authors and comments, with their replies, and anything labelled', async () => {
		const hidden = comment('3khidden', { createdAt: at(2) });
		fakeAtmosphere({
			handles: HANDLES,
			comments: [
				comment('3kshown', { createdAt: at(1) }),
				hidden,
				comment('3kreply', { did: BOB, subject: commentUri(hidden), createdAt: at(3) }),
				comment('3kbob', { did: BOB, createdAt: at(4) }),
				comment('3knsfw', { createdAt: at(5), labels: ['nudity'] }),
				comment('3koptout', { createdAt: at(6), labels: ['!no-unauthenticated'] }),
				// listed under this post, but its record says it's on another
				comment('3kelsewhere', {
					createdAt: at(7),
					subject: 'at://did:plc:x/site.standard.document/3l',
					listedUnder: POST
				}),
				comment('3kblank', { createdAt: at(8), text: '  ' }),
				// deleted since Constellation saw it
				comment('3kgone', { createdAt: at(9), deleted: true }),
				comment('3kundated', { createdAt: 'yesterday' })
			]
		});
		comments(`${commentUri(hidden)} ${BOB}`);
		await loaded();
		expect(thread()).toEqual(['@alice.example: comment 3kshown']);
	});

	it('shows a DID for an author whose handle won’t resolve', async () => {
		fakeAtmosphere({ comments: [comment('3ka', { did: 'did:plc:nohandle' })] });
		comments();
		await loaded();
		expect(thread()).toEqual(['did:plc:nohandle: comment 3ka']);
	});

	it('pages back through earlier comments and replies', async () => {
		const top = Array.from({ length: 27 }, (_, n) =>
			comment(`3kt${String(n).padStart(2, '0')}`, { createdAt: at(n + 1) })
		);
		const parent = top.at(-1)!;
		const replies = Array.from({ length: 11 }, (_, n) =>
			comment(`3kr${String(n).padStart(2, '0')}`, {
				did: BOB,
				subject: commentUri(parent),
				createdAt: at(30 + n)
			})
		);
		fakeAtmosphere({ handles: HANDLES, comments: [...top, ...replies] });
		comments();
		await vi.waitFor(() => expect(thread()).toHaveLength(25 + 10));
		expect(thread()[0]).toBe('@alice.example: comment 3kt02');

		await page.getByRole('button', { name: 'Show earlier comments' }).click();
		await vi.waitFor(() => expect(thread()[0]).toBe('@alice.example: comment 3kt00'));
		await expect
			.element(page.getByRole('button', { name: 'Show earlier comments' }))
			.not.toBeInTheDocument();

		await page.getByRole('button', { name: 'Show earlier replies' }).click();
		await vi.waitFor(() => expect(thread()).toHaveLength(27 + 11));
		const shown = thread();
		expect(shown.indexOf('  @bob.example: comment 3kr00')).toBe(
			shown.indexOf('@alice.example: comment 3kt26') + 1
		);
	});

	it('lets the reader try an earlier page again', async () => {
		const world = fakeAtmosphere({
			handles: HANDLES,
			comments: Array.from({ length: 26 }, (_, n) =>
				comment(`3kt${String(n).padStart(2, '0')}`, { createdAt: at(n + 1) })
			)
		});
		comments();
		await vi.waitFor(() => expect(thread()).toHaveLength(25));
		world.fail = (url) =>
			url.searchParams.get('cursor') ? new Response('', { status: 500 }) : null;
		await page.getByRole('button', { name: 'Show earlier comments' }).click();
		const again = page.getByRole('button', { name: "Couldn't load them. Try again" });
		await expect.element(again).toBeEnabled();
		world.fail = () => null;
		await again.click();
		await vi.waitFor(() => expect(thread()).toHaveLength(26));
	});

	it('says when a comment’s replies won’t load, and tries again', async () => {
		const parent = comment('3ka');
		const world = fakeAtmosphere({
			handles: HANDLES,
			comments: [
				parent,
				comment('3kb', { did: BOB, subject: commentUri(parent), createdAt: at(2) })
			]
		});
		world.fail = (url) =>
			url.searchParams.get('target') === commentUri(parent)
				? new Response('', { status: 500 })
				: null;
		comments();
		await expect.element(page.getByText("Couldn't load the replies.")).toBeVisible();
		world.fail = () => null;
		await page.getByRole('button', { name: 'Try again' }).click();
		await vi.waitFor(() => expect(thread()).toHaveLength(2));
	});
});

describe('<standard-site-comments>: signed out', () => {
	it('asks the reader to sign in to comment, and opens the box when they’re back', async () => {
		fakeAtmosphere();
		comments();
		await page
			.getByRole('button', { name: 'Sign in with your Atmosphere account to comment' })
			.click();
		const dialog = page.getByRole('dialog', { name: 'Sign in' });
		await dialog.getByRole('textbox').fill('reader.example');
		await dialog.getByRole('button', { name: 'Continue' }).click();
		await vi.waitFor(() => expect(client.signInRedirect).toHaveBeenCalled());
		expect(JSON.parse(client.signInRedirect.mock.calls[0][1].state).pending).toEqual({
			kind: 'compose',
			subject: POST,
			rootSubject: POST
		});
	});

	it('asks them to sign in to reply, too', async () => {
		fakeAtmosphere({ handles: HANDLES, comments: [comment('3ka')] });
		comments();
		await page.getByRole('button', { name: 'Reply to @alice.example' }).click();
		await page.getByRole('dialog').getByRole('textbox').fill('reader.example');
		await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click();
		await vi.waitFor(() => expect(client.signInRedirect).toHaveBeenCalled());
		expect(JSON.parse(client.signInRedirect.mock.calls[0][1].state).pending).toEqual({
			kind: 'compose',
			subject: commentUri(comment('3ka')),
			rootSubject: POST
		});
	});

	it('says so when it can’t sign in with that handle', async () => {
		fakeAtmosphere();
		client.signInRedirect.mockRejectedValueOnce(new Error('Failed to resolve identity'));
		comments();
		await page
			.getByRole('button', { name: 'Sign in with your Atmosphere account to comment' })
			.click();
		const dialog = page.getByRole('dialog', { name: 'Sign in' });
		await dialog.getByRole('textbox').fill('nobody.example');
		await dialog.getByRole('button', { name: 'Continue' }).click();
		await expect
			.element(dialog.getByRole('alert'))
			.toHaveTextContent("Couldn't sign in with that handle.");
		await expect.element(dialog.getByRole('button', { name: 'Continue' })).toBeEnabled();
		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});
});

describe('<standard-site-comments>: signed in', () => {
	it('says who’s signed in, and signs them out', async () => {
		fakeAtmosphere({ handles: HANDLES, comments: [comment('3kmine', { did: READER })] });
		returning();
		comments();
		await vi.waitFor(() =>
			expect(document.querySelector('.standard-site-account')!.textContent).toBe(
				'Signed in as @reader.example · Sign out'
			)
		);
		await expect.element(page.getByRole('button', { name: 'Delete your comment' })).toBeVisible();

		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect.element(page.getByRole('status')).toHaveTextContent('Signed out.');
		expect(client.revoke).toHaveBeenCalledWith(READER);
		expect(window.localStorage.getItem('standard-site:did')).toBeNull();
		const signIn = page.getByRole('button', {
			name: 'Sign in with your Atmosphere account to comment'
		});
		await expect.element(signIn).toHaveFocus();
		await expect
			.element(page.getByRole('button', { name: 'Delete your comment' }))
			.not.toBeInTheDocument();
		expect(document.querySelector<HTMLElement>('.standard-site-account')!.hidden).toBe(true);
	});

	it('posts a comment, shows it at once and moves focus to it', async () => {
		fakeAtmosphere({ handles: HANDLES, comments: [comment('3ka')] });
		const repo = returning();
		comments();
		const box = page.getByRole('textbox', { name: 'Your comment' });
		await box.fill('Hello **there**');
		await page.getByRole('button', { name: 'Comment', exact: true }).click();

		await expect.element(page.getByRole('status')).toHaveTextContent('Comment posted.');
		expect(thread()).toEqual(['@alice.example: comment 3ka', '@reader.example: Hello there']);
		expect(written(repo)).toEqual([
			{ $type: COMMENT, subject: POST, text: 'Hello **there**', createdAt: expect.any(String) }
		]);
		await expect.element(article('reader.example')).toHaveFocus();
		await expect.element(box).toHaveValue('');
	});

	it('replaces “No comments yet.” with the first comment', async () => {
		fakeAtmosphere({ handles: HANDLES });
		returning();
		comments();
		await page.getByRole('textbox', { name: 'Your comment' }).fill('first!');
		await page.getByRole('button', { name: 'Comment', exact: true }).click();
		await expect.element(page.getByText('No comments yet.')).not.toBeVisible();
		expect(thread()).toEqual(['@reader.example: first!']);
	});

	it('replies inline, under the comment, with the post as its root', async () => {
		const parent = comment('3ka');
		fakeAtmosphere({ handles: HANDLES, comments: [parent] });
		const repo = returning();
		comments();
		await page.getByRole('button', { name: 'Reply to @alice.example' }).click();
		const box = page.getByRole('textbox', { name: 'Your reply to @alice.example' });
		await expect.element(box).toHaveFocus();
		await box.fill('a reply');
		await page.getByRole('button', { name: 'Reply', exact: true }).click();

		await expect.element(page.getByRole('status')).toHaveTextContent('Reply posted.');
		expect(thread()).toEqual(['@alice.example: comment 3ka', '  @reader.example: a reply']);
		expect(written(repo)).toEqual([
			{
				$type: COMMENT,
				subject: commentUri(parent),
				rootSubject: POST,
				text: 'a reply',
				createdAt: expect.any(String)
			}
		]);
		await expect.element(box).not.toBeInTheDocument();
		await expect.element(article('reader.example')).toHaveFocus();
	});

	it('closes a reply box on Cancel, back to its Reply button', async () => {
		fakeAtmosphere({ handles: HANDLES, comments: [comment('3ka')] });
		returning();
		comments();
		const reply = page.getByRole('button', { name: 'Reply to @alice.example' });
		await reply.click();
		await reply.click();
		await expect
			.element(page.getByRole('textbox', { name: 'Your reply to @alice.example' }))
			.toHaveFocus();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect.element(page.getByRole('textbox', { name: YOUR_REPLY })).not.toBeInTheDocument();
		await expect.element(reply).toHaveFocus();
	});

	it('shows a reply once, when Constellation catches up while it was still loading', async () => {
		const parent = comment('3ka');
		const world = fakeAtmosphere({ handles: HANDLES, comments: [parent] });
		const repo = returning();
		const release = world.hold((url) => url.searchParams.get('target') === commentUri(parent));
		comments();
		await page.getByRole('button', { name: 'Reply to @alice.example' }).click();
		await page.getByRole('textbox', { name: YOUR_REPLY }).fill('quick');
		await page.getByRole('button', { name: 'Reply', exact: true }).click();
		await expect.element(page.getByRole('status')).toHaveTextContent('Reply posted.');
		const [{ rkey }] = repo.records[COMMENT];
		world.comments.push(
			comment(rkey, { did: READER, subject: commentUri(parent), text: 'quick', createdAt: at(9) })
		);
		release();
		await vi.waitFor(() =>
			expect(
				world.requests.some(
					(url) =>
						url.pathname === '/xrpc/com.atproto.repo.getRecord' &&
						url.searchParams.get('rkey') === rkey
				)
			).toBe(true)
		);
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(thread()).toEqual(['@alice.example: comment 3ka', '  @reader.example: quick']);
	});

	it('checks the comment against the lexicon’s limits, with a count near them', async () => {
		fakeAtmosphere();
		const repo = returning();
		comments();
		const box = page.getByRole('textbox', { name: 'Your comment' });
		const send = page.getByRole('button', { name: 'Comment', exact: true });
		await box.fill('   ');
		await send.click();
		await expect.element(page.getByRole('alert')).toHaveTextContent('Write something first.');
		await expect.element(box).toHaveFocus();

		await box.fill('a'.repeat(4_499));
		await expect.element(box).toHaveAccessibleDescription('');
		// a family emoji is one character, however many code points
		await box.fill(`${'a'.repeat(4_499)}👨‍👩‍👧`);
		await expect.element(box).toHaveAccessibleDescription('4,500 / 5,000');
		await box.fill('a'.repeat(5_001));
		await send.click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent("That's too long to post. Shorten it a little.");
		expect(repo.calls).toEqual([]);
	});

	it('says so, and keeps the text, when the comment can’t be posted', async () => {
		fakeAtmosphere();
		const repo = returning();
		repo.fail = () => Response.json({ error: 'InternalServerError' }, { status: 500 });
		comments();
		const box = page.getByRole('textbox', { name: 'Your comment' });
		await box.fill('keep me');
		await page.getByRole('button', { name: 'Comment', exact: true }).click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent("Couldn't post that. Try again.");
		await expect.element(box).toHaveValue('keep me');
	});

	it('signs in again, with the comment, when the PDS refuses the session', async () => {
		fakeAtmosphere();
		const repo = returning();
		repo.fail = () => Response.json({ error: 'ScopeMissingError' }, { status: 403 });
		comments();
		await page.getByRole('textbox', { name: 'Your comment' }).fill('hold this');
		await page.getByRole('button', { name: 'Comment', exact: true }).click();
		await vi.waitFor(() => expect(client.signInRedirect).toHaveBeenCalled());
		expect(JSON.parse(client.signInRedirect.mock.calls[0][1].state).pending).toEqual({
			kind: 'comment',
			subject: POST,
			rootSubject: POST,
			text: 'hold this'
		});
	});

	it('deletes the reader’s own comment after asking, in the page', async () => {
		const mine = comment('3kmine', { did: READER, createdAt: at(2), text: 'oops' });
		fakeAtmosphere({ handles: HANDLES, comments: [comment('3ka'), mine] });
		const repo = returning(
			fakeRepo({ did: READER, records: { [COMMENT]: [{ rkey: '3kmine', value: {} }] } })
		);
		comments();
		// only their own comment has a Delete button
		await expect.element(page.getByRole('button', { name: 'Delete your comment' })).toBeVisible();
		await page.getByRole('button', { name: 'Delete your comment' }).click();
		await expect.element(page.getByText('Delete this comment?')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Keep' })).toHaveFocus();

		await page.getByRole('button', { name: 'Keep' }).click();
		await expect.element(page.getByRole('button', { name: 'Delete your comment' })).toHaveFocus();

		await page.getByRole('button', { name: 'Delete your comment' }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect.element(page.getByRole('status')).toHaveTextContent('Comment deleted.');
		expect(thread()).toEqual(['@alice.example: comment 3ka']);
		expect(repo.records[COMMENT]).toEqual([]);
		await expect.element(article('alice.example')).toHaveFocus();
	});

	it('moves focus to “No comments yet.” when the last comment goes', async () => {
		fakeAtmosphere({ handles: HANDLES, comments: [comment('3kmine', { did: READER })] });
		returning(fakeRepo({ did: READER, records: { [COMMENT]: [{ rkey: '3kmine', value: {} }] } }));
		comments();
		await page.getByRole('button', { name: 'Delete your comment' }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect.element(page.getByText('No comments yet.')).toHaveFocus();
	});

	it('says so when a comment can’t be deleted', async () => {
		fakeAtmosphere({ handles: HANDLES, comments: [comment('3kmine', { did: READER })] });
		const repo = returning();
		repo.fail = () => new Response('', { status: 500 });
		comments();
		await page.getByRole('button', { name: 'Delete your comment' }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect
			.element(article('reader.example').getByRole('alert'))
			.toHaveTextContent("Couldn't delete your comment.");
		expect(thread()).toHaveLength(1);
	});
});

describe('<standard-site-comments>: edges', () => {
	it('moves focus to the comment a deleted reply answered', async () => {
		const parent = comment('3ka');
		fakeAtmosphere({
			handles: HANDLES,
			comments: [
				parent,
				comment('3kmine', { did: READER, subject: commentUri(parent), createdAt: at(2) })
			]
		});
		returning(fakeRepo({ did: READER, records: { [COMMENT]: [{ rkey: '3kmine', value: {} }] } }));
		comments();
		await page.getByRole('button', { name: 'Delete your comment' }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect.element(article('alice.example')).toHaveFocus();
	});

	it('asks a reader signed out in another tab to sign in when they post', async () => {
		fakeAtmosphere();
		returning();
		comments();
		const box = page.getByRole('textbox', { name: 'Your comment' });
		await box.fill('still here?');
		window.localStorage.clear();
		await page.getByRole('button', { name: 'Comment', exact: true }).click();
		await expect.element(page.getByRole('dialog', { name: 'Sign in' })).toBeVisible();
		await expect.element(box).toHaveValue('still here?');
	});

	it('shows a comment whose PDS didn’t say what it made, without a Delete button', async () => {
		fakeAtmosphere({ handles: HANDLES });
		const repo = returning();
		repo.fail = (nsid) => (nsid.endsWith('createRecord') ? Response.json({}) : null);
		comments();
		await page.getByRole('textbox', { name: 'Your comment' }).fill('no uri');
		await page.getByRole('button', { name: 'Comment', exact: true }).click();
		await expect.element(page.getByRole('status')).toHaveTextContent('Comment posted.');
		expect(thread()).toEqual(['@reader.example: no uri']);
		await expect
			.element(page.getByRole('button', { name: 'Delete your comment' }))
			.not.toBeInTheDocument();
	});

	it('says so when a delete it was finishing fails', async () => {
		fakeAtmosphere();
		window.localStorage.setItem('standard-site:did', READER);
		window.sessionStorage.setItem(
			'standard-site:pending',
			JSON.stringify({
				kind: 'delete',
				uri: 'at://did:plc:reader/at.upvote.comment/3k',
				rootSubject: POST
			})
		);
		comments();
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent("Couldn't delete your comment.");
	});

	it('ignores a pending action it can’t read', async () => {
		fakeAtmosphere();
		window.sessionStorage.setItem('standard-site:pending', '{not json');
		comments();
		await expect.element(page.getByText('No comments yet.')).toBeVisible();
	});

	it('works without a hide list', async () => {
		fakeAtmosphere({ handles: HANDLES, comments: [comment('3ka')] });
		document.body.innerHTML = `<standard-site-comments subject="${POST}"></standard-site-comments>`;
		await vi.waitFor(() => expect(thread()).toEqual(['@alice.example: comment 3ka']));
	});
});

describe('<standard-site-comments>: back from signing in', () => {
	const back = (action: object) =>
		window.sessionStorage.setItem('standard-site:pending', JSON.stringify(action));

	it('posts the comment the reader signed in to post', async () => {
		fakeAtmosphere({ handles: HANDLES });
		const repo = returning();
		back({ kind: 'comment', subject: POST, rootSubject: POST, text: 'made it' });
		comments();
		await expect.element(page.getByRole('status')).toHaveTextContent('Comment posted.');
		expect(thread()).toEqual(['@reader.example: made it']);
		expect(written(repo)).toHaveLength(1);
	});

	it('posts a reply to a comment that hasn’t shown up yet, and says so', async () => {
		fakeAtmosphere({ handles: HANDLES });
		const repo = returning();
		back({
			kind: 'comment',
			subject: commentUri(comment('3kdeep')),
			rootSubject: POST,
			text: 'deep'
		});
		comments();
		await expect.element(page.getByRole('status')).toHaveTextContent('Reply posted.');
		expect(written(repo)).toEqual([expect.objectContaining({ text: 'deep', rootSubject: POST })]);
	});

	it('keeps the text in the box if it still can’t post', async () => {
		fakeAtmosphere();
		window.localStorage.setItem('standard-site:did', READER);
		back({ kind: 'comment', subject: POST, rootSubject: POST, text: 'not yet' });
		comments();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent("Couldn't post your comment. Try again.");
		await expect
			.element(page.getByRole('textbox', { name: 'Your comment' }))
			.toHaveValue('not yet');
		expect(client.signInRedirect).not.toHaveBeenCalled();
	});

	it('opens the box they signed in to write in', async () => {
		fakeAtmosphere();
		returning();
		back({ kind: 'compose', subject: POST, rootSubject: POST });
		comments();
		await expect.element(page.getByRole('textbox', { name: 'Your comment' })).toHaveFocus();
	});

	it('opens the reply they signed in to write, once its comment shows', async () => {
		const parent = comment('3ka');
		const child = comment('3kb', { did: BOB, subject: commentUri(parent), createdAt: at(2) });
		fakeAtmosphere({ handles: HANDLES, comments: [parent, child] });
		returning();
		back({ kind: 'compose', subject: commentUri(child), rootSubject: POST });
		comments();
		await expect
			.element(page.getByRole('textbox', { name: 'Your reply to @bob.example' }))
			.toHaveFocus();
	});

	it('opens a reply box on a top-level comment straight away', async () => {
		const parent = comment('3ka');
		fakeAtmosphere({ handles: HANDLES, comments: [parent] });
		returning();
		back({ kind: 'compose', subject: commentUri(parent), rootSubject: POST });
		comments();
		await expect
			.element(page.getByRole('textbox', { name: 'Your reply to @alice.example' }))
			.toHaveFocus();
	});

	it('finishes deleting the comment they signed in to delete', async () => {
		const mine = comment('3kmine', { did: READER });
		fakeAtmosphere({ handles: HANDLES, comments: [mine] });
		const repo = returning(
			fakeRepo({ did: READER, records: { [COMMENT]: [{ rkey: '3kmine', value: {} }] } })
		);
		back({ kind: 'delete', uri: commentUri(mine), rootSubject: POST });
		comments();
		await expect.element(page.getByRole('status')).toHaveTextContent('Comment deleted.');
		expect(repo.records[COMMENT]).toEqual([]);
		expect(thread()).toEqual([]);
	});

	it('leaves another post’s actions alone', async () => {
		fakeAtmosphere();
		back({ kind: 'compose', subject: 'at://x/y/z', rootSubject: 'at://x/y/z' });
		comments();
		await loaded();
		expect(window.sessionStorage.getItem('standard-site:pending')).not.toBeNull();
	});
});

it('moves local dev to 127.0.0.1 before signing in: nothing to do here, already there', async () => {
	fakeAtmosphere();
	comments();
	await page
		.getByRole('button', { name: 'Sign in with your Atmosphere account to comment' })
		.click();
	await expect.element(page.getByRole('dialog')).toBeVisible();
	await userEvent.keyboard('{Escape}');
	await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
});
