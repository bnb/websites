import type { ComponentProps } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { client, construct, resetClient } from '@bnb/atmosphere/testing/oauth-client';
import { fakeRepo } from '@bnb/atmosphere/testing/repo';
import { Likes, MESSAGE_MS } from '../likes';
import Like from './Like.svelte';

vi.mock('@atproto/oauth-client-browser', () => import('@bnb/atmosphere/testing/oauth-client'));

const GALLERY = 'at://did:plc:author/social.grain.gallery/3lbushwick';
const OTHER = 'at://did:plc:author/social.grain.gallery/3lridgewood';
const FAVORITE = 'social.grain.favorite';
const READER = 'did:plc:reader';
const HEART = /^Like photograph 03/;

const like = (subject: string, rkey: string) => ({
	rkey,
	value: { $type: FAVORITE, subject, createdAt: '2026-10-01T00:00:00.000Z' }
});

/** A reader who signed in here before, whose session restores to `repo`. */
function returning(repo = fakeRepo()) {
	window.localStorage.setItem('tierney.camera:did', repo.did);
	client.restore.mockResolvedValue(repo.session);
	return repo;
}

async function show(props: Partial<ComponentProps<typeof Like>> = {}) {
	const store = new Likes();
	const view = await render(Like, {
		subject: GALLERY,
		label: 'photograph 03',
		counts: { [GALLERY]: 8 },
		store,
		...props
	});
	return { ...view, store, heart: page.getByRole('button', { name: HEART }) };
}

const subjects = (repo: ReturnType<typeof fakeRepo>) =>
	(repo.records[FAVORITE] ?? []).map((record) => record.value.subject);

beforeEach(() => {
	resetClient();
	window.localStorage.clear();
	window.sessionStorage.clear();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('Like (component)', () => {
	it('is a toggle named for its photograph, with the count from the server', async () => {
		const { heart } = await show();
		await expect.element(heart).toHaveAccessibleName('Like photograph 03, 8 likes');
		await expect.element(heart).toHaveAttribute('aria-pressed', 'false');
		await expect.element(heart).toHaveTextContent('8');
	});

	it('says one like, and shows no number for none or for a count it doesn’t have', async () => {
		const { rerender, heart } = await show({ counts: { [GALLERY]: 1 } });
		await expect.element(heart).toHaveAccessibleName('Like photograph 03, 1 like');
		await rerender({ counts: { [GALLERY]: 0 } });
		await expect.element(heart).toHaveAccessibleName('Like photograph 03');
		expect(heart.element().textContent?.trim()).toBe('');
		await rerender({ counts: {} });
		await expect.element(heart).toHaveAccessibleName('Like photograph 03');
	});

	it('doesn’t load the sign-in for a reader who has never signed in', async () => {
		const { store } = await show();
		await expect(store.restore()).resolves.toBeNull();
		expect(client.restore).not.toHaveBeenCalled();
		expect(construct).not.toHaveBeenCalled();
	});

	it('asks a new reader for their handle, and signs them in with it', async () => {
		const { heart } = await show();
		await heart.click();

		const dialog = page.getByRole('dialog', { name: 'Sign in to like' });
		await expect.element(dialog).toBeVisible();
		const field = dialog.getByRole('textbox', { name: 'Your handle' });
		await expect.element(field).toHaveFocus();
		await expect
			.element(dialog.getByText('Any Atmosphere account works, Bluesky included.'))
			.toBeVisible();

		await field.fill(' @reader.example ');
		await dialog.getByRole('button', { name: 'Continue' }).click();
		await vi.waitFor(() => expect(client.signInRedirect).toHaveBeenCalled());
		expect(client.signInRedirect).toHaveBeenCalledWith('reader.example', {
			scope: 'atproto repo:social.grain.favorite?action=create&action=delete',
			state: JSON.stringify({ like: GALLERY, returnTo: window.location.href })
		});
		// on its way to the reader's authorization server
		await expect.element(dialog.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
	});

	it('lets a new reader back out, back to the heart', async () => {
		const { heart } = await show();
		await heart.click();
		const dialog = page.getByRole('dialog', { name: 'Sign in to like' });
		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect.element(dialog).not.toBeInTheDocument();
		await expect.element(heart).toHaveFocus();

		await heart.click();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(client.signInRedirect).not.toHaveBeenCalled();
	});

	it('says so when it can’t sign in with that handle, and lets them try again', async () => {
		client.signInRedirect.mockRejectedValueOnce(
			new Error('Failed to resolve identity: nobody.example')
		);
		const { heart } = await show();
		await heart.click();
		const dialog = page.getByRole('dialog', { name: 'Sign in to like' });
		await dialog.getByRole('textbox').fill('nobody.example');
		await dialog.getByRole('button', { name: 'Continue' }).click();
		await expect
			.element(dialog.getByRole('alert'))
			.toHaveTextContent("Couldn't sign in with that handle.");

		await dialog.getByRole('textbox').fill('reader.example');
		await dialog.getByRole('button', { name: 'Continue' }).click();
		await vi.waitFor(() =>
			expect(client.signInRedirect).toHaveBeenLastCalledWith('reader.example', expect.anything())
		);
		await expect.element(dialog.getByRole('alert')).not.toBeInTheDocument();
	});

	it('shows a returning reader what they’ve liked', async () => {
		const repo = returning(
			fakeRepo({ records: { [FAVORITE]: [like(OTHER, '3ka'), like(GALLERY, '3kb')] } })
		);
		const { store, heart } = await show();
		await expect(store.restore()).resolves.toBeNull();
		expect(client.restore).toHaveBeenCalledWith(READER);
		await expect.element(heart).toHaveAttribute('aria-pressed', 'true');
		// the count already has their like in it
		await expect.element(heart).toHaveAccessibleName('Like photograph 03, 8 likes');
		expect(repo.calls.every(([method]) => method === 'GET')).toBe(true);
	});

	it('likes at once, and writes the like to the reader’s repo', async () => {
		const repo = returning();
		const { store, heart } = await show();
		await store.restore();
		const release = repo.hold();
		await heart.click();

		// before the PDS has answered
		await expect.element(heart).toHaveAttribute('aria-pressed', 'true');
		await expect.element(heart).toHaveAccessibleName('Like photograph 03, 9 likes');
		release();

		await vi.waitFor(() => expect(subjects(repo)).toEqual([GALLERY]));
		const [, , body] = repo.calls.at(-1)!;
		expect(body).toEqual({
			repo: READER,
			collection: FAVORITE,
			record: { $type: FAVORITE, subject: GALLERY, createdAt: expect.any(String) }
		});
		expect(Number.isNaN(Date.parse((body.record as { createdAt: string }).createdAt))).toBe(false);
	});

	it('doesn’t add a second like made in another tab', async () => {
		const repo = returning();
		const { store, heart } = await show();
		await store.restore();
		repo.records[FAVORITE] = [like(GALLERY, '3kother-tab')];
		await store.toggle(GALLERY);
		await expect.element(heart).toHaveAttribute('aria-pressed', 'true');
		expect(subjects(repo)).toEqual([GALLERY]);
		expect(repo.calls.some(([, nsid]) => nsid.endsWith('createRecord'))).toBe(false);
	});

	it('unlikes, deleting every like of the gallery, duplicates and all', async () => {
		const repo = returning(
			fakeRepo({
				records: { [FAVORITE]: [like(GALLERY, '3ka'), like(OTHER, '3kb'), like(GALLERY, '3kc')] }
			})
		);
		const { store, heart } = await show();
		await store.restore();
		await heart.click();
		await expect.element(heart).toHaveAttribute('aria-pressed', 'false');
		await expect.element(heart).toHaveAccessibleName('Like photograph 03, 7 likes');
		await vi.waitFor(() => expect(subjects(repo)).toEqual([OTHER]));
	});

	it('ignores clicks while a like is being written', async () => {
		const repo = returning();
		const { store, heart } = await show();
		await store.restore();
		const release = repo.hold();
		await heart.click();
		await heart.click();
		release();
		await vi.waitFor(() => expect(subjects(repo)).toEqual([GALLERY]));
		await expect.element(heart).toHaveAttribute('aria-pressed', 'true');
	});

	it('changes back, and says so briefly, when the like can’t be saved', async () => {
		const repo = returning();
		repo.fail = (nsid) =>
			nsid.endsWith('createRecord')
				? Response.json({ error: 'InternalServerError' }, { status: 500 })
				: null;
		const { store, heart } = await show();
		await store.restore();
		await heart.click();

		const alert = page.getByRole('alert');
		await expect.element(alert).toHaveTextContent("Couldn't save your like.");
		await expect.element(heart).toHaveAttribute('aria-pressed', 'false');
		await expect.element(heart).toHaveAccessibleName('Like photograph 03, 8 likes');

		vi.useFakeTimers({ toFake: ['setTimeout'] });
		vi.advanceTimersByTime(MESSAGE_MS);
		vi.useRealTimers();
		await expect.element(alert).not.toBeInTheDocument();
	});

	it('changes back when an unlike can’t be saved', async () => {
		const repo = returning(fakeRepo({ records: { [FAVORITE]: [like(GALLERY, '3ka')] } }));
		repo.fail = (nsid) =>
			nsid.endsWith('deleteRecord') ? new Response('', { status: 502 }) : null;
		const { store, heart } = await show();
		await store.restore();
		await heart.click();
		await expect.element(page.getByRole('alert')).toHaveTextContent("Couldn't remove your like.");
		await expect.element(heart).toHaveAttribute('aria-pressed', 'true');
	});

	it('sends a returning reader whose session expired straight back to sign in', async () => {
		window.localStorage.setItem('tierney.camera:did', READER);
		const { heart } = await show();
		await heart.click();
		await vi.waitFor(() => expect(client.signInRedirect).toHaveBeenCalled());
		expect(client.signInRedirect).toHaveBeenCalledWith(READER, expect.anything());
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('asks for their handle when that can’t start', async () => {
		window.localStorage.setItem('tierney.camera:did', READER);
		client.signInRedirect.mockRejectedValueOnce(new Error('PLC directory is down'));
		const { heart } = await show();
		await heart.click();
		await expect.element(page.getByRole('dialog', { name: 'Sign in to like' })).toBeVisible();
	});

	it('still works when it can’t tell what a returning reader likes', async () => {
		const repo = returning();
		repo.fail = (nsid) => (nsid.endsWith('listRecords') ? new Response('', { status: 503 }) : null);
		const { store, heart } = await show();
		await store.restore();
		await expect.element(heart).toHaveAttribute('aria-pressed', 'false');
		repo.fail = () => null;
		await heart.click();
		await vi.waitFor(() => expect(subjects(repo)).toEqual([GALLERY]));
	});

	it('makes the like a reader signed in to make, once they’re back', async () => {
		const repo = returning();
		window.sessionStorage.setItem('tierney.camera:like', GALLERY);
		const { store, heart } = await show();
		await expect(store.restore()).resolves.toBe(GALLERY);
		expect(subjects(repo)).toEqual([GALLERY]);
		await expect.element(heart).toHaveAttribute('aria-pressed', 'true');
		await expect.element(heart).toHaveAccessibleName('Like photograph 03, 9 likes');
		expect(window.sessionStorage.getItem('tierney.camera:like')).toBeNull();
	});

	it('doesn’t make it twice if they’d already liked it', async () => {
		const repo = returning(fakeRepo({ records: { [FAVORITE]: [like(GALLERY, '3ka')] } }));
		window.sessionStorage.setItem('tierney.camera:like', GALLERY);
		const { store } = await show();
		await expect(store.restore()).resolves.toBeNull();
		expect(subjects(repo)).toEqual([GALLERY]);
	});

	it('restores once, however many hearts ask', async () => {
		returning();
		const store = new Likes();
		await Promise.all([store.restore(), store.restore()]);
		expect(client.restore).toHaveBeenCalledOnce();
	});

	it('restores a returning reader with session storage blocked', async () => {
		const repo = returning(fakeRepo({ records: { [FAVORITE]: [like(GALLERY, '3ka')] } }));
		const getItem = Storage.prototype.getItem;
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
			if (this === window.sessionStorage)
				throw new DOMException('The operation is insecure.', 'SecurityError');
			return getItem.call(this, key);
		});
		const { store, heart } = await show();
		await expect(store.restore()).resolves.toBeNull();
		await expect.element(heart).toHaveAttribute('aria-pressed', 'true');
		expect(repo.calls.every(([method]) => method === 'GET')).toBe(true);
	});
});
