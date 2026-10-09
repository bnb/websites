import { describe, expect, it } from 'vitest';
import { needsSignIn } from './errors';
import { createRecord, deleteRecord, listRecords } from './repo';
import { fakeRepo } from './testing/repo';

const FAVORITE = 'social.grain.favorite';
const GALLERY = 'at://did:plc:author/social.grain.gallery/3lgallery';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('createRecord', () => {
	it('writes a record of the collection’s type to the reader’s repo', async () => {
		const repo = fakeRepo();
		const created = await createRecord(repo.session, FAVORITE, {
			subject: GALLERY,
			createdAt: '2026-10-09T00:00:00.000Z'
		});
		expect(created).toEqual({
			uri: 'at://did:plc:reader/social.grain.favorite/3knew0',
			cid: 'cid-3knew0'
		});
		expect(repo.calls).toEqual([
			[
				'POST',
				'com.atproto.repo.createRecord',
				{
					repo: 'did:plc:reader',
					collection: FAVORITE,
					record: { $type: FAVORITE, subject: GALLERY, createdAt: '2026-10-09T00:00:00.000Z' }
				}
			]
		]);
		const [[, init]] = repo.session.fetchHandler.mock.calls as [[string, RequestInit]];
		expect(init.headers).toEqual({ 'content-type': 'application/json' });
	});

	it('hands back null when the PDS doesn’t say what it made', async () => {
		const repo = fakeRepo();
		repo.fail = () => json({});
		await expect(createRecord(repo.session, FAVORITE, {})).resolves.toBeNull();
	});

	it('says what the PDS said when it fails: its message, its error code, or its status', async () => {
		const repo = fakeRepo();
		const failing = (response: Response) => {
			repo.fail = () => response;
			return createRecord(repo.session, FAVORITE, {});
		};
		await expect(
			failing(json({ error: 'InvalidRequest', message: 'Bad record' }, 400))
		).rejects.toMatchObject({
			name: 'AtmosphereError',
			kind: 'http',
			status: 400,
			message: 'Bad record'
		});
		await expect(failing(json({ error: 'ExpiredToken', message: '' }, 401))).rejects.toMatchObject({
			message: 'ExpiredToken'
		});
		await expect(failing(new Response('nope', { status: 502 }))).rejects.toMatchObject({
			message: 'com.atproto.repo.createRecord failed with 502'
		});
	});

	it('says so when the PDS can’t be reached', async () => {
		const repo = fakeRepo();
		repo.session.fetchHandler.mockRejectedValueOnce(new TypeError('Failed to fetch'));
		await expect(createRecord(repo.session, FAVORITE, {})).rejects.toMatchObject({
			kind: 'network',
			message: 'Failed to fetch'
		});
	});
});

describe('deleteRecord', () => {
	it('deletes a record from the reader’s repo', async () => {
		const repo = fakeRepo({ records: { [FAVORITE]: [{ rkey: '3kmine', value: {} }] } });
		await deleteRecord(repo.session, FAVORITE, '3kmine');
		expect(repo.records[FAVORITE]).toEqual([]);
		expect(repo.calls).toEqual([
			[
				'POST',
				'com.atproto.repo.deleteRecord',
				{ repo: 'did:plc:reader', collection: FAVORITE, rkey: '3kmine' }
			]
		]);
	});
});

describe('listRecords', () => {
	it('lists every record in a collection, across pages, with their rkeys', async () => {
		const repo = fakeRepo({
			pageSize: 2,
			records: {
				[FAVORITE]: ['3kc', '3kb', '3ka'].map((rkey) => ({ rkey, value: { subject: rkey } }))
			}
		});
		const records = await listRecords<{ subject: string }>(repo.session, FAVORITE);
		expect(records.map(({ rkey, value }) => [rkey, value.subject])).toEqual([
			['3kc', '3kc'],
			['3kb', '3kb'],
			['3ka', '3ka']
		]);
		expect(records[0]).toEqual({
			uri: 'at://did:plc:reader/social.grain.favorite/3kc',
			cid: 'cid-3kc',
			rkey: '3kc',
			value: { subject: '3kc' }
		});
		// two full pages and an empty third, each a GET for the reader's own repo
		expect(repo.calls.map(([method, , query]) => [method, query.cursor])).toEqual([
			['GET', undefined],
			['GET', '2'],
			['GET', '4']
		]);
		expect(repo.calls[0][2]).toEqual({
			repo: 'did:plc:reader',
			collection: FAVORITE,
			limit: '100'
		});
	});

	it('stops at the last page, even one with no cursor', async () => {
		const repo = fakeRepo();
		repo.fail = () =>
			json({ records: [{ uri: 'at://did:plc:reader/x.y.z/3kone', cid: 'c', value: {} }] });
		await expect(listRecords(repo.session, 'x.y.z')).resolves.toHaveLength(1);
		expect(repo.calls).toHaveLength(1);
	});

	it('stops after 100 pages of a PDS that never runs out', async () => {
		const repo = fakeRepo();
		repo.fail = () =>
			json({
				records: [{ uri: 'at://did:plc:reader/x.y.z/3kloop', cid: 'c', value: {} }],
				cursor: 'again'
			});
		await expect(listRecords(repo.session, 'x.y.z')).resolves.toHaveLength(100);
	});

	it('fails on an answer with no records in it', async () => {
		const repo = fakeRepo();
		repo.fail = () => json({ cursor: '1' });
		await expect(listRecords(repo.session, FAVORITE)).rejects.toMatchObject({ kind: 'invalid' });
		repo.fail = () => json({ error: 'InvalidRequest' }, 400);
		await expect(listRecords(repo.session, FAVORITE)).rejects.toMatchObject({
			kind: 'http',
			message: 'InvalidRequest'
		});
	});
});

describe('needsSignIn', () => {
	const failing = async (fail: (repo: ReturnType<typeof fakeRepo>) => void) => {
		const repo = fakeRepo();
		fail(repo);
		return createRecord(repo.session, FAVORITE, {}).catch((error: unknown) => error);
	};

	it('says so when the PDS refuses the session, or the session is gone', async () => {
		const scope = await failing((repo) => {
			repo.fail = () =>
				json({ error: 'InsufficientScope', message: 'Missing required scope' }, 403);
		});
		expect(needsSignIn(scope)).toBe(true);
		const expired = await failing((repo) => {
			repo.fail = () => json({ error: 'ExpiredToken' }, 401);
		});
		expect(needsSignIn(expired)).toBe(true);
		const revoked = await failing((repo) => {
			repo.session.fetchHandler.mockRejectedValueOnce(
				Object.assign(new Error('The session was revoked'), { name: 'TokenRevokedError' })
			);
		});
		expect(revoked).toMatchObject({ kind: 'auth', message: 'The session was revoked' });
		expect(needsSignIn(revoked)).toBe(true);
		const nameless = await failing((repo) => {
			repo.session.fetchHandler.mockRejectedValueOnce(
				Object.assign(new Error(''), { name: 'TokenRefreshError' })
			);
		});
		expect(nameless).toMatchObject({ kind: 'auth', message: 'Signed out' });
	});

	it('doesn’t for anything else', async () => {
		const broken = await failing((repo) => {
			repo.fail = () => json({ error: 'InternalServerError' }, 500);
		});
		expect(needsSignIn(broken)).toBe(false);
		const offline = await failing((repo) => {
			repo.session.fetchHandler.mockRejectedValueOnce(new TypeError('Failed to fetch'));
		});
		expect(needsSignIn(offline)).toBe(false);
		expect(needsSignIn(new Error('not ours'))).toBe(false);
	});
});
