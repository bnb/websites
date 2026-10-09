import { describe, expect, it, vi } from 'vitest';
import { loadLatest, thumbUrl } from './index';

const PDS = 'https://pds.example';

/** The PLC directory, and a PDS whose collections hold these newest records; any other collection fails. */
function pds(newest: Record<string, object | null>) {
	return vi.fn(async (input: RequestInfo | URL) => {
		if (String(input).startsWith('https://plc.directory/')) {
			return Response.json({
				service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }]
			});
		}
		const collection = new URL(String(input)).searchParams.get('collection') ?? '';
		if (!(collection in newest)) return new Response('', { status: 500 });
		const value = newest[collection];
		return Response.json({
			records: value ? [{ uri: `at://x/${collection}/1`, cid: 'c', value }] : []
		});
	});
}

describe('loadLatest', () => {
	it('reads the newest post, photo and mix from the account’s PDS, one request each', async () => {
		const fetchFn = pds({
			'site.standard.document': {
				title: 'What is the Atmosphere',
				publishedAt: '2026-10-02T00:00:00.000Z'
			},
			'social.grain.photo': {
				photo: { $type: 'blob', ref: { $link: 'bafyphoto' }, mimeType: 'image/jpeg', size: 1 },
				alt: 'A Bushwick rooftop at dusk',
				aspectRatio: { width: 3, height: 2 },
				createdAt: '2026-09-16T20:14:27.303Z'
			},
			'fm.plyr.track': { title: 'tachycardia 028', createdAt: '2026-08-25T23:53:12.562Z' }
		});

		await expect(loadLatest(fetchFn)).resolves.toEqual({
			bnb: { kind: 'post', title: 'What is the Atmosphere', date: '2026-10-02T00:00:00.000Z' },
			camera: {
				kind: 'photo',
				image: {
					src: thumbUrl('bafyphoto'),
					alt: 'A Bushwick rooftop at dusk',
					width: 3,
					height: 2
				},
				date: '2026-09-16T20:14:27.303Z'
			},
			dj: { kind: 'mix', title: 'tachycardia 028', date: '2026-08-25T23:53:12.562Z' }
		});
		// the DID document, then one read per collection, all from the account's PDS
		expect(fetchFn).toHaveBeenCalledTimes(4);
		expect(String(fetchFn.mock.calls[1][0])).toContain(`${PDS}/xrpc/com.atproto.repo.listRecords`);
	});

	it('gives a photo with no alt text or aspect ratio an empty alt and no size', async () => {
		const fetchFn = pds({
			'social.grain.photo': {
				photo: { $type: 'blob', ref: { $link: 'bafyphoto' }, mimeType: 'image/jpeg', size: 1 },
				createdAt: '2026-09-16T20:14:27.303Z'
			}
		});

		const latest = await loadLatest(fetchFn);
		expect(latest.camera).toStrictEqual({
			kind: 'photo',
			image: { src: thumbUrl('bafyphoto'), alt: '' },
			date: '2026-09-16T20:14:27.303Z'
		});
	});

	it('leaves out sites whose read fails, or whose newest record has no date', async () => {
		const fetchFn = pds({
			'site.standard.document': { title: 'undated' },
			'social.grain.photo': null
		});

		await expect(loadLatest(fetchFn)).resolves.toEqual({});

		const offline = vi.fn(async () => {
			throw new Error('network down');
		});
		await expect(loadLatest(offline)).resolves.toEqual({});
	});
});
