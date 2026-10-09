import { describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_PDS,
	DID,
	assemblePhotos,
	blobUrl,
	fullUrl,
	loadPortfolio,
	thumbUrl
} from './atproto';
import type { AtpRecord, ExifRecord, GalleryItemRecord, GalleryRecord, PhotoRecord } from './types';

function photo(rkey: string, extra: Partial<PhotoRecord> = {}): AtpRecord<PhotoRecord> {
	return {
		uri: `at://${DID}/social.grain.photo/${rkey}`,
		cid: `cid-${rkey}`,
		value: {
			$type: 'social.grain.photo',
			photo: { $type: 'blob', ref: { $link: `blob-${rkey}` }, mimeType: 'image/jpeg', size: 1 },
			aspectRatio: { width: 2000, height: 1333 },
			createdAt: '2026-09-17T00:00:00Z',
			...extra
		}
	};
}

describe('assemblePhotos', () => {
	it('joins exif + gallery location and sorts by posted date (newest first)', () => {
		// photo "a": posted Sep 17, taken Jul 9.  photo "b": posted Sep 10, taken Aug 20.
		// "b" was captured more recently, but "a" was posted more recently, so sorting
		// by posted date must put "a" first (proving it's not sorting by capture date).
		const photos = [photo('a'), photo('b', { createdAt: '2026-09-10T00:00:00Z' })];
		const exifs: AtpRecord<ExifRecord>[] = [
			{
				uri: 'e1',
				cid: 'e1',
				value: {
					$type: 'social.grain.photo.exif',
					photo: photos[0].uri,
					make: 'SONY',
					model: 'ILCE-7RM4',
					lensModel: 'FE 50mm F1.4 GM',
					iSO: 12_800_000_000,
					fNumber: 2_200_000,
					exposureTime: 12500,
					focalLengthIn35mmFormat: 50_000_000,
					dateTimeOriginal: '2026-07-09T14:00:50Z'
				}
			},
			{
				uri: 'e2',
				cid: 'e2',
				value: {
					$type: 'social.grain.photo.exif',
					photo: photos[1].uri,
					dateTimeOriginal: '2026-08-20T10:00:00Z'
				}
			}
		];
		const galleries: AtpRecord<GalleryRecord>[] = [
			{
				uri: 'g1',
				cid: 'g1',
				value: {
					$type: 'social.grain.gallery',
					title: 'Untitled',
					location: { name: 'Bushwick' },
					address: { region: 'New York' },
					createdAt: '2026-09-17T00:00:00Z'
				}
			}
		];
		const galleryItems: AtpRecord<GalleryItemRecord>[] = [
			{
				uri: 'gi1',
				cid: 'gi1',
				value: {
					$type: 'social.grain.gallery.item',
					item: photos[0].uri,
					gallery: 'g1',
					position: 0,
					createdAt: '2026-09-17T00:00:00Z'
				}
			}
		];

		const result = assemblePhotos({ photos, exifs, galleryItems, galleries });
		expect(result).toHaveLength(2);

		// photo "a" (posted Sep 17) sorts ahead of photo "b" (posted Sep 10),
		// even though "b" was captured more recently.
		expect(result[0].cid).toBe('blob-a');
		expect(result[1].cid).toBe('blob-b');
		expect(result[0].uri).toBe(photos[0].uri);

		const a = result[0];
		expect(a).toMatchObject({
			camera: 'Sony α7R IV',
			lens: 'FE 50mm ƒ/1.4 GM',
			aperture: 'ƒ/2.2',
			shutter: '1/80',
			iso: 'ISO 12800',
			focal: '50mm',
			place: 'Bushwick, New York',
			ev: expect.closeTo(1.6, 1)
		});
		// display date is still the capture date; posted date drives the sort
		expect(a.date).toBe('2026-07-09T14:00:50Z');
		expect(a.posted).toBe('2026-09-17T00:00:00Z');
	});

	it('gives each photo its gallery’s uri, which is what a like favorites', () => {
		const [inGallery, loose, orphaned] = [photo('a'), photo('b'), photo('c')];
		const result = assemblePhotos({
			photos: [inGallery, loose, orphaned],
			exifs: [],
			galleryItems: [
				item(inGallery.uri, 'bushwick'),
				// an item left behind by a deleted gallery
				item(orphaned.uri, 'deleted')
			],
			galleries: [gallery('bushwick', { location: { name: 'Bushwick' } })]
		});
		const byUri = new Map(result.map((p) => [p.uri, p]));
		expect(byUri.get(inGallery.uri)).toMatchObject({
			gallery: `at://${DID}/social.grain.gallery/bushwick`,
			place: 'Bushwick'
		});
		expect(byUri.get(loose.uri)).not.toHaveProperty('gallery');
		expect(byUri.get(orphaned.uri)).not.toHaveProperty('gallery');
		expect(byUri.get(orphaned.uri)?.place).toBe('');
	});

	it('keeps two records of the same file apart by record uri', () => {
		const sameFile = { photo: photo('a').value.photo };
		const result = assemblePhotos({
			photos: [photo('a', sameFile), photo('b', sameFile)],
			exifs: [],
			galleryItems: [],
			galleries: []
		});
		expect(result.map((p) => p.cid)).toEqual(['blob-a', 'blob-a']);
		expect(new Set(result.map((p) => p.uri)).size).toBe(2);
	});

	it('drops photos without a blob and survives missing exif/gallery', () => {
		const good = photo('good');
		const bad = photo('bad');
		// @ts-expect-error: simulate a malformed record from the wire
		bad.value.photo = undefined;

		const result = assemblePhotos({
			photos: [good, bad],
			exifs: [],
			galleryItems: [],
			galleries: []
		});
		expect(result).toHaveLength(1);
		expect(result[0].place).toBe('');
		expect(result[0].camera).toBe('');
		expect(result[0].ev).toBeNull();
		expect(result[0].width).toBe(2000);
	});
});

describe('image urls', () => {
	it('builds CDN + raw-blob urls', () => {
		expect(thumbUrl('X')).toBe(`https://cdn.bsky.app/img/feed_thumbnail/plain/${DID}/X@jpeg`);
		expect(fullUrl('X')).toBe(`https://cdn.bsky.app/img/feed_fullsize/plain/${DID}/X@jpeg`);
		expect(blobUrl('https://pds.example', 'X')).toBe(
			`https://pds.example/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=X`
		);
	});
});

// ── loadPortfolio, against a fake PDS ────────────────────────────────────────

const PDS = 'https://pds.test';

/** A JSON body to answer with, or an HTTP status to fail with. */
type Reply = object | number;

const answer = (reply: Reply) =>
	typeof reply === 'number' ? new Response('nope', { status: reply }) : Response.json(reply);

/**
 * A fetch that plays the PLC directory and a PDS. `records` holds each
 * collection's pages (or a status to fail its reads with); the cursor for the
 * page after `n` is "page-n+1".
 */
function fakeNetwork({
	plc = {
		service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }]
	},
	pds = PDS,
	records,
	profile = 404
}: {
	plc?: Reply;
	pds?: string;
	records: Record<string, AtpRecord<unknown>[][] | number>;
	profile?: Reply;
}) {
	return vi.fn(async (input: RequestInfo | URL) => {
		const url = new URL(String(input));
		if (url.origin === 'https://plc.directory') {
			expect(url.pathname).toBe(`/${DID}`);
			return answer(plc);
		}

		expect(url.origin).toBe(pds);
		expect(url.searchParams.get('repo')).toBe(DID);
		const collection = url.searchParams.get('collection') ?? '';

		if (url.pathname === '/xrpc/com.atproto.repo.getRecord') {
			expect(collection).toBe('social.grain.actor.profile');
			expect(url.searchParams.get('rkey')).toBe('self');
			return answer(profile);
		}

		expect(url.pathname).toBe('/xrpc/com.atproto.repo.listRecords');
		const pages = records[collection] ?? [[]];
		if (typeof pages === 'number') return answer(pages);
		const n = Number(url.searchParams.get('cursor')?.replace('page-', '') ?? 0);
		const cursor = n + 1 < pages.length ? `page-${n + 1}` : undefined;
		return answer({ records: pages[n], cursor });
	});
}

const exif = (photoUri: string, extra: Partial<ExifRecord> = {}): AtpRecord<ExifRecord> => ({
	uri: `${photoUri}/exif`,
	cid: 'exif',
	value: { $type: 'social.grain.photo.exif', photo: photoUri, ...extra }
});

const gallery = (rkey: string, value: Partial<GalleryRecord>): AtpRecord<GalleryRecord> => ({
	uri: `at://${DID}/social.grain.gallery/${rkey}`,
	cid: rkey,
	value: { $type: 'social.grain.gallery', createdAt: '2026-09-01T00:00:00Z', ...value }
});

const item = (photoUri: string, galleryRkey: string): AtpRecord<GalleryItemRecord> => ({
	uri: `${photoUri}/item`,
	cid: 'item',
	value: {
		$type: 'social.grain.gallery.item',
		item: photoUri,
		gallery: `at://${DID}/social.grain.gallery/${galleryRkey}`,
		createdAt: '2026-09-01T00:00:00Z'
	}
});

describe('loadPortfolio', () => {
	it('reads every page of photographs from the PDS the DID document names', async () => {
		// a full first page, so the read has to follow the cursor to the second
		const firstPage = Array.from({ length: 100 }, (_, i) =>
			photo(`p${String(i).padStart(3, '0')}`, { createdAt: '2026-08-01T00:00:00Z' })
		);
		const newest = photo('newest', { createdAt: '2026-09-20T00:00:00Z' });
		const fetchFn = fakeNetwork({
			records: {
				'social.grain.photo': [firstPage, [newest]],
				'social.grain.photo.exif': [
					[exif(newest.uri, { make: 'SONY', model: 'ILCE-7RM4', iSO: 12_800_000_000 })]
				],
				'social.grain.gallery.item': [[item(newest.uri, 'bushwick')]],
				'social.grain.gallery': [
					[gallery('bushwick', { location: { name: 'Bushwick' }, address: { region: 'New York' } })]
				]
			},
			profile: {
				value: {
					$type: 'social.grain.actor.profile',
					displayName: 'tierney cyren',
					description: 'girl rave dj. photographer.',
					avatar: { $type: 'blob', ref: { $link: 'avatar-cid' }, mimeType: 'image/jpeg', size: 1 }
				}
			}
		});

		const portfolio = await loadPortfolio(fetchFn);

		expect(portfolio.pds).toBe(PDS);
		expect(portfolio.profile).toEqual({
			displayName: 'tierney cyren',
			description: 'girl rave dj. photographer.',
			avatarCid: 'avatar-cid'
		});
		expect(portfolio.photos).toHaveLength(101);
		expect(portfolio.photos[0]).toMatchObject({
			uri: newest.uri,
			cid: 'blob-newest',
			camera: 'Sony α7R IV',
			iso: 'ISO 12800',
			place: 'Bushwick, New York'
		});
		const reads = fetchFn.mock.calls.map(([input]) => new URL(String(input)));
		expect(
			reads.filter((url) => url.searchParams.get('collection') === 'social.grain.photo')
		).toHaveLength(2);
	});

	it('still shows the photographs when EXIF and galleries cannot be read', async () => {
		const fetchFn = fakeNetwork({
			records: {
				'social.grain.photo': [[photo('a')]],
				'social.grain.photo.exif': 500,
				'social.grain.gallery.item': 503,
				'social.grain.gallery': 502
			}
		});

		const portfolio = await loadPortfolio(fetchFn);

		expect(portfolio.photos).toHaveLength(1);
		expect(portfolio.photos[0]).toMatchObject({ cid: 'blob-a', camera: '', place: '', iso: '' });
		expect(portfolio.profile).toBeNull();
	});

	it('fails when the photographs themselves cannot be read', async () => {
		const fetchFn = fakeNetwork({ records: { 'social.grain.photo': 502 } });
		await expect(loadPortfolio(fetchFn)).rejects.toThrow('listRecords social.grain.photo → 502');
	});

	it('falls back to the default PDS when the DID document is unavailable', async () => {
		const fetchFn = fakeNetwork({
			plc: 500,
			pds: DEFAULT_PDS,
			records: { 'social.grain.photo': [[photo('a')]] }
		});

		const portfolio = await loadPortfolio(fetchFn);
		expect(portfolio.pds).toBe(DEFAULT_PDS);
		expect(portfolio.photos.map((p) => p.cid)).toEqual(['blob-a']);
	});

	it('fills the gaps in a sparse profile', async () => {
		const fetchFn = fakeNetwork({
			records: { 'social.grain.photo': [[]] },
			profile: { value: { $type: 'social.grain.actor.profile' } }
		});

		const portfolio = await loadPortfolio(fetchFn);
		expect(portfolio.profile).toEqual({ displayName: '', description: '', avatarCid: null });
		expect(portfolio.photos).toEqual([]);
	});

	it('names places from a gallery’s locality when it has no location or region', async () => {
		const [town, nowhere, orphan] = [photo('town'), photo('nowhere'), photo('orphan')];
		const fetchFn = fakeNetwork({
			records: {
				'social.grain.photo': [[town, nowhere, orphan]],
				'social.grain.gallery.item': [
					[item(town.uri, 'town'), item(nowhere.uri, 'nowhere'), item(orphan.uri, 'deleted')]
				],
				'social.grain.gallery': [
					[
						gallery('town', { address: { locality: 'Brooklyn', country: 'US' } }),
						gallery('nowhere', { title: 'No address' })
					]
				]
			}
		});

		const portfolio = await loadPortfolio(fetchFn);
		const place = (cid: string) => portfolio.photos.find((p) => p.cid === cid)?.place;
		expect(place('blob-town')).toBe('Brooklyn');
		expect(place('blob-nowhere')).toBe('');
		expect(place('blob-orphan')).toBe('');
	});

	it('defaults the shape and dates of a record that leaves them out', async () => {
		const bare = photo('bare');
		delete bare.value.aspectRatio;
		// @ts-expect-error: simulate a record from the wire without a createdAt
		delete bare.value.createdAt;
		const fetchFn = fakeNetwork({ records: { 'social.grain.photo': [[bare]] } });

		const [only] = (await loadPortfolio(fetchFn)).photos;
		expect(only).toMatchObject({ width: 3, height: 2, alt: '', date: '', posted: '' });
	});
});
