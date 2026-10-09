import { DEFAULT_PDS, DID } from '@bnb/atproto';
import { describe, expect, it, vi } from 'vitest';
import { assembleMixes, coverAt, loadCrate } from './plyr';
import type { AtpRecord, TrackRecord } from './types';

const PDS = 'https://pds.example';

function track(rkey: string, value: Partial<TrackRecord> = {}): AtpRecord<TrackRecord> {
	return {
		uri: `at://${DID}/fm.plyr.track/${rkey}`,
		cid: `cid-${rkey}`,
		value: {
			$type: 'fm.plyr.track',
			title: `mix ${rkey}`,
			artist: 'tierney cyren',
			audioUrl: `https://audio.plyr.fm/audio/${rkey}.mp3`,
			duration: 3430,
			fileType: 'mp3',
			imageUrl: `https://images.plyr.fm/images/${rkey}.png`,
			audioBlob: {
				$type: 'blob',
				ref: { $link: `blob-${rkey}` },
				mimeType: 'audio/mpeg',
				size: 1
			},
			createdAt: '2026-08-25T23:53:12Z',
			...value
		}
	};
}

describe('assembleMixes', () => {
	it('streams from plyr.fm first, then the raw blob, newest first', () => {
		const mixes = assembleMixes(
			[
				track('a'),
				track('b', { createdAt: '2026-09-01T15:40:29Z', description: 'one\r\ntwo\r\n' })
			],
			PDS
		);
		expect(mixes.map((mix) => mix.title)).toEqual(['mix b', 'mix a']);
		expect(mixes[0]).toMatchObject({
			sources: [
				'https://audio.plyr.fm/audio/b.mp3',
				`${PDS}/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=blob-b`
			],
			mimeType: 'audio/mpeg',
			format: 'MP3',
			duration: 3430,
			image: 'https://images.plyr.fm/images/b.png',
			description: 'one\ntwo'
		});
	});

	it('works out the format and type from the file when the record does not say', () => {
		const [mix] = assembleMixes(
			[
				track('w', {
					fileType: undefined,
					audioUrl: 'https://audio.plyr.fm/audio/w.WAV',
					audioBlob: undefined
				})
			],
			PDS
		);
		expect(mix).toMatchObject({
			format: 'WAV',
			mimeType: 'audio/wav',
			sources: ['https://audio.plyr.fm/audio/w.WAV']
		});
	});

	it('falls back to the blob alone, and drops what can’t be played or has no title', () => {
		const mixes = assembleMixes(
			[
				track('blob', {
					audioUrl: 'http://insecure.example/a.mp3',
					imageUrl: 'javascript:alert(1)'
				}),
				track('none', { audioUrl: undefined, audioBlob: undefined }),
				track('untitled', { title: '' })
			],
			PDS
		);
		expect(mixes).toHaveLength(1);
		expect(mixes[0].sources).toEqual([
			`${PDS}/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=blob-blob`
		]);
		expect(mixes[0].image).toBe('');
	});

	it('copes with sparse records', () => {
		const [mix] = assembleMixes(
			[
				track('sparse', {
					artist: undefined,
					duration: undefined,
					fileType: undefined,
					audioUrl: 'https://audio.plyr.fm/audio/no-extension',
					audioBlob: undefined,
					createdAt: undefined as unknown as string
				})
			],
			PDS
		);
		expect(mix).toMatchObject({ artist: '', duration: 0, format: '', mimeType: '', date: '' });
	});
});

const json = (body: unknown, ok = true) =>
	({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as Response;

describe('loadCrate', () => {
	it('reads the tracks and the plyr.fm bio from the resolved PDS', async () => {
		const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.startsWith('https://plc.directory/')) {
				return json({ service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] });
			}
			if (url.includes('listRecords')) return json({ records: [track('a')] });
			return json({ value: { bio: '  girl rave dj in bushwick ' } });
		});

		const crate = await loadCrate(fetchFn as unknown as typeof fetch);
		expect(crate.pds).toBe(PDS);
		expect(crate.bio).toBe('girl rave dj in bushwick');
		expect(crate.profile).toBe('at://did:plc:uashgn65n5z7aqwk5cbuba5c/fm.plyr.actor.profile/self');
		expect(crate.mixes).toHaveLength(1);
		expect(
			fetchFn.mock.calls.some(([url]) => String(url).includes('collection=fm.plyr.track'))
		).toBe(true);
	});

	it('has an empty bio without a profile, and fails when the tracks can’t be read', async () => {
		const noProfile = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('listRecords')) return json({ records: [] });
			return json({}, false);
		});
		await expect(loadCrate(noProfile as unknown as typeof fetch)).resolves.toEqual({
			bio: '',
			profile: null,
			mixes: [],
			pds: DEFAULT_PDS
		});

		const down = vi.fn(async () => json({}, false));
		await expect(loadCrate(down as unknown as typeof fetch)).rejects.toThrow();
	});
});

describe('coverAt', () => {
	it('resizes plyr.fm covers and leaves others alone', () => {
		expect(coverAt('https://images.plyr.fm/images/a.png', 600)).toBe(
			'https://images.plyr.fm/cdn-cgi/image/width=600,format=auto/images/a.png'
		);
		expect(coverAt('https://elsewhere.example/a.png', 600)).toBe('https://elsewhere.example/a.png');
		expect(coverAt('', 600)).toBe('');
	});
});
