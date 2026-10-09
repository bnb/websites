import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { client, resetClient } from '@bnb/atmosphere/testing/oauth-client';
import { fakeRepo } from '@bnb/atmosphere/testing/repo';
import { fakeAtmosphere } from '../test/atmosphere';
import './discussion';

vi.mock('@atproto/oauth-client-browser', () => import('@bnb/atmosphere/testing/oauth-client'));

const POST = 'at://did:plc:author/site.standard.document/3lpost';
const OTHER = 'at://did:plc:author/site.standard.document/3lother';
const READER = 'did:plc:reader';
const UPVOTE = 'at.upvote.signal';
const BUTTON = /^Upvote/;

beforeEach(() => {
	resetClient();
	window.localStorage.clear();
	window.sessionStorage.clear();
	document.body.innerHTML = '';
});

afterEach(() => {
	vi.restoreAllMocks();
});

function upvote() {
	document.body.innerHTML = `<standard-site-upvote subject="${POST}"></standard-site-upvote>`;
	return page.getByRole('button', { name: BUTTON });
}

/** A reader who signed in here before, whose session restores to `repo`. */
function returning(repo = fakeRepo({ did: READER })) {
	window.localStorage.setItem('standard-site:did', READER);
	client.restore.mockResolvedValue(repo.session);
	return repo;
}

const subjects = (repo: ReturnType<typeof fakeRepo>) =>
	(repo.records[UPVOTE] ?? []).map((record) => record.value.subject);

describe('<standard-site-upvote>', () => {
	it('shows how many people have upvoted the post', async () => {
		const world = fakeAtmosphere({
			upvotes: [
				{ did: 'did:plc:a', subject: POST },
				{ did: 'did:plc:b', subject: POST },
				{ did: 'did:plc:c', subject: OTHER }
			]
		});
		const button = upvote();
		await expect.element(button).toHaveAccessibleName('Upvote, 2 upvotes');
		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
		await expect.element(button).toHaveTextContent('▲ Upvote 2');
		// one count, and no reader to look up
		expect(world.requests.map((url) => url.pathname)).toEqual(['/links/count']);
	});

	it('says one upvote, and shows no number for none or when Constellation is down', async () => {
		const world = fakeAtmosphere({ upvotes: [{ did: 'did:plc:a', subject: POST }] });
		await expect.element(upvote()).toHaveAccessibleName('Upvote, 1 upvote');
		world.upvotes = [];
		await expect.element(upvote()).toHaveAccessibleName('Upvote');
		world.fail = () => new Response('', { status: 503 });
		const button = upvote();
		await expect.element(button).toHaveAccessibleName('Upvote');
		await expect.element(button).toHaveTextContent('▲ Upvote');
	});

	it('shows a returning reader their own upvote', async () => {
		fakeAtmosphere({ upvotes: [{ did: READER, subject: POST }] });
		returning();
		await expect.element(upvote()).toHaveAttribute('aria-pressed', 'true');
	});

	it('asks a new reader to sign in, and comes back to finish the upvote', async () => {
		fakeAtmosphere();
		await upvote().click();
		const dialog = page.getByRole('dialog', { name: 'Sign in' });
		await expect.element(dialog.getByRole('textbox', { name: 'Your handle' })).toHaveFocus();
		await userEvent.keyboard('@reader.example');
		await dialog.getByRole('button', { name: 'Continue' }).click();
		await vi.waitFor(() => expect(client.signInRedirect).toHaveBeenCalled());
		expect(client.signInRedirect).toHaveBeenCalledWith('reader.example', {
			scope:
				'atproto repo:site.standard.graph.subscription?action=create&action=delete repo:at.upvote.signal?action=create&action=delete repo:at.upvote.comment?action=create&action=delete',
			state: JSON.stringify({
				pending: { kind: 'upvote', subject: POST, on: true },
				returnTo: window.location.href
			})
		});
	});

	it('upvotes at once, and writes the upvote to the reader’s repo', async () => {
		fakeAtmosphere({ upvotes: [{ did: 'did:plc:a', subject: POST }] });
		const repo = returning();
		const button = upvote();
		await expect.element(button).toHaveAccessibleName('Upvote, 1 upvote');
		const release = repo.hold();
		await button.click();
		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
		await expect.element(button).toHaveAccessibleName('Upvote, 2 upvotes');
		release();
		await vi.waitFor(() => expect(subjects(repo)).toEqual([POST]));
		expect(repo.records[UPVOTE][0].value).toEqual({
			$type: UPVOTE,
			subject: POST,
			createdAt: expect.any(String)
		});
	});

	it('never stacks a second upvote, and takes back every one', async () => {
		fakeAtmosphere();
		const upvoted = (rkey: string) => ({ rkey, value: { $type: UPVOTE, subject: POST } });
		// upvoted in another app since the page loaded
		const repo = returning(fakeRepo({ did: READER, records: { [UPVOTE]: [upvoted('3ka')] } }));
		const button = upvote();
		await expect.element(button).toHaveAccessibleName('Upvote');
		await button.click();
		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
		await vi.waitFor(() => expect(repo.calls.at(-1)?.[1]).toBe('com.atproto.repo.listRecords'));
		expect(subjects(repo)).toEqual([POST]);

		repo.records[UPVOTE].push(upvoted('3kdupe'));
		await button.click();
		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
		await vi.waitFor(() => expect(subjects(repo)).toEqual([]));
	});

	it('changes back, and says so, when the upvote can’t be saved', async () => {
		fakeAtmosphere({ upvotes: [{ did: 'did:plc:a', subject: POST }] });
		const repo = returning();
		repo.fail = (nsid) =>
			nsid.endsWith('createRecord')
				? Response.json({ error: 'InternalServerError' }, { status: 500 })
				: null;
		const button = upvote();
		await expect.element(button).toHaveAccessibleName('Upvote, 1 upvote');
		await button.click();
		await expect.element(page.getByRole('alert')).toHaveTextContent("Couldn't save your upvote.");
		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
		await expect.element(button).toHaveAccessibleName('Upvote, 1 upvote');
	});

	it('says so when it can’t take one back', async () => {
		fakeAtmosphere({ upvotes: [{ did: READER, subject: POST }] });
		const repo = returning(
			fakeRepo({ did: READER, records: { [UPVOTE]: [{ rkey: '3ka', value: { subject: POST } }] } })
		);
		repo.fail = (nsid) =>
			nsid.endsWith('deleteRecord') ? new Response('', { status: 502 }) : null;
		const button = upvote();
		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
		await button.click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent("Couldn't take back your upvote.");
		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
	});

	it('sends a returning reader whose session expired back to sign in, with the upvote', async () => {
		fakeAtmosphere();
		window.localStorage.setItem('standard-site:did', READER);
		await upvote().click();
		await vi.waitFor(() => expect(client.signInRedirect).toHaveBeenCalled());
		const [identity, { state }] = client.signInRedirect.mock.calls[0] as [
			string,
			{ state: string }
		];
		expect(identity).toBe(READER);
		expect(JSON.parse(state).pending).toEqual({ kind: 'upvote', subject: POST, on: true });
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('signs in again when the PDS refuses an older, narrower session', async () => {
		fakeAtmosphere();
		const repo = returning();
		repo.fail = (nsid) =>
			nsid.endsWith('listRecords')
				? Response.json(
						{ error: 'ScopeMissingError', message: 'Missing required scope' },
						{ status: 403 }
					)
				: null;
		await upvote().click();
		await vi.waitFor(() => expect(client.signInRedirect).toHaveBeenCalled());
		expect(JSON.parse(client.signInRedirect.mock.calls[0][1].state).pending).toMatchObject({
			kind: 'upvote'
		});
	});

	it('finishes an upvote the reader signed in to make, once they’re back', async () => {
		fakeAtmosphere({ upvotes: [{ did: 'did:plc:a', subject: POST }] });
		const repo = returning();
		window.sessionStorage.setItem(
			'standard-site:pending',
			JSON.stringify({ kind: 'upvote', subject: POST, on: true })
		);
		const button = upvote();
		await expect.element(button).toHaveAccessibleName('Upvote, 2 upvotes');
		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
		await vi.waitFor(() => expect(subjects(repo)).toEqual([POST]));
		expect(window.sessionStorage.getItem('standard-site:pending')).toBeNull();
	});

	it('doesn’t send the reader round again if their session still won’t do', async () => {
		fakeAtmosphere();
		window.localStorage.setItem('standard-site:did', READER);
		window.sessionStorage.setItem(
			'standard-site:pending',
			JSON.stringify({ kind: 'upvote', subject: POST, on: true })
		);
		upvote();
		await expect.element(page.getByRole('alert')).toHaveTextContent("Couldn't save your upvote.");
		expect(client.signInRedirect).not.toHaveBeenCalled();
	});

	it('leaves another post’s pending upvote alone', async () => {
		fakeAtmosphere();
		window.sessionStorage.setItem(
			'standard-site:pending',
			JSON.stringify({ kind: 'upvote', subject: OTHER, on: true })
		);
		await expect.element(upvote()).toHaveAccessibleName('Upvote');
		expect(window.sessionStorage.getItem('standard-site:pending')).not.toBeNull();
	});

	it('ignores clicks while an upvote is being written', async () => {
		fakeAtmosphere();
		const repo = returning();
		const button = upvote();
		await expect.element(button).toHaveAccessibleName('Upvote');
		const release = repo.hold();
		await button.click();
		await button.click();
		release();
		await vi.waitFor(() => expect(subjects(repo)).toEqual([POST]));
		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
	});

	it('shows the count when it can’t tell if a returning reader upvoted', async () => {
		const world = fakeAtmosphere({ upvotes: [{ did: READER, subject: POST }] });
		world.fail = (url) => (url.searchParams.get('did') ? new Response('', { status: 500 }) : null);
		returning();
		const button = upvote();
		await expect.element(button).toHaveAccessibleName('Upvote, 1 upvote');
		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
	});

	it('is only defined once, however many times the script loads', async () => {
		const { StandardSiteUpvote } = await import('./upvote');
		const specifier = './discussion.ts?again';
		await import(/* @vite-ignore */ specifier);
		expect(customElements.get('standard-site-upvote')).toBe(StandardSiteUpvote);
	});

	it('still upvotes when Constellation can’t count', async () => {
		const world = fakeAtmosphere();
		world.fail = (url) =>
			url.pathname === '/links/count' ? new Response('', { status: 503 }) : null;
		const repo = returning();
		const button = upvote();
		await button.click();
		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
		await expect.element(button).toHaveAccessibleName('Upvote');
		await vi.waitFor(() => expect(subjects(repo)).toEqual([POST]));
	});
});
