import { describe, expect, it } from 'vitest';
import { blobCid, canonicalJson, imageInfo } from './bytes';

describe('blobCid', () => {
	// what the original JavaScript blobCid gives the same bytes; the first is the
	// well-known CIDv1 (raw, sha2-256) of zero bytes
	it.each([
		[Buffer.alloc(0), 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'],
		[Buffer.from('a post'), 'bafkreiaxtqbp52735npxbekqbclxmfpq5tnfleitje5kyloaeryxcakkmy'],
		[Buffer.from('hello world'), 'bafkreifzjut3te2nhyekklss27nh3k72ysco7y32koao5eei66wof36n5e'],
		[
			Buffer.from([0x89, 0x50, 0x4e, 0x47]),
			'bafkreiapiy3mpd3f2nrz5ts2azfvvz2t4naimffbj6yyvngxkqgsyjefim'
		]
	])('matches the CID a PDS gives the same bytes (%#)', (bytes, cid) => {
		expect(blobCid(bytes)).toBe(cid);
	});
});

// a WebP file's first bytes, with its chunk type
const webp = (chunk: string) => {
	const bytes = Buffer.alloc(40);
	bytes.write('RIFF', 0, 'ascii');
	bytes.write('WEBP', 8, 'ascii');
	bytes.write(chunk, 12, 'ascii');
	return bytes;
};

// SOF0: length, precision, height 480, width 640
const SOF0 = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x00, 0x00, 0x00];

// a JPEG holding an EXIF orientation, in either byte order, before its frame
function exifJpeg(orientation: number, order: 'II' | 'MM' = 'II') {
	const u16 = (value: number) =>
		order === 'II' ? [value & 0xff, value >> 8] : [value >> 8, value & 0xff];
	const u32 = (value: number) => (order === 'II' ? [value, 0, 0, 0] : [0, 0, 0, value]);
	const exif = [
		...Buffer.from('Exif\0\0'),
		...Buffer.from(order),
		...u16(42),
		...u32(8),
		// one IFD entry: Orientation, SHORT, count 1, value
		...u16(1),
		...u16(0x0112),
		...u16(3),
		...u32(1),
		...u16(orientation),
		0,
		0
	];
	return Buffer.from([
		0xff,
		0xd8,
		0xff,
		0xe1,
		(exif.length + 2) >> 8,
		(exif.length + 2) & 0xff,
		...exif,
		...SOF0
	]);
}

describe('imageInfo', () => {
	it('reads PNG dimensions', () => {
		const png = Buffer.alloc(32);
		png.writeUInt32BE(0x89504e47, 0);
		png.writeUInt32BE(1200, 16);
		png.writeUInt32BE(630, 20);
		expect(imageInfo(png)).toEqual({ mimeType: 'image/png', width: 1200, height: 630 });
	});

	it('reads GIF dimensions', () => {
		const gif = Buffer.alloc(16);
		gif.write('GIF89a', 0, 'ascii');
		gif.writeUInt16LE(40, 6);
		gif.writeUInt16LE(30, 8);
		expect(imageInfo(gif)).toEqual({ mimeType: 'image/gif', width: 40, height: 30 });
	});

	it('reads WebP (VP8) dimensions, without the scaling bits', () => {
		const bytes = webp('VP8 ');
		bytes.writeUInt16LE(0xc000 | 320, 26);
		bytes.writeUInt16LE(0x4000 | 240, 28);
		expect(imageInfo(bytes)).toEqual({ mimeType: 'image/webp', width: 320, height: 240 });
	});

	it('reads WebP (VP8L) dimensions', () => {
		const bytes = webp('VP8L');
		// 14 bits each of width - 1 and height - 1
		bytes.writeUInt32LE((99 << 14) | 199, 21);
		expect(imageInfo(bytes)).toEqual({ mimeType: 'image/webp', width: 200, height: 100 });
	});

	it('reads WebP (VP8X) dimensions', () => {
		const bytes = webp('VP8X');
		bytes.writeUIntLE(1263, 24, 3);
		bytes.writeUIntLE(855, 27, 3);
		expect(imageInfo(bytes)).toEqual({ mimeType: 'image/webp', width: 1264, height: 856 });
	});

	it('reads JPEG dimensions past other segments', () => {
		// an APP0 segment, then the frame
		const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, ...SOF0]);
		expect(imageInfo(jpeg)).toEqual({ mimeType: 'image/jpeg', width: 640, height: 480 });
	});

	it('skips JPEG segments that only look like frames', () => {
		// DHT (0xC4), JPG (0xC8) and DAC (0xCC) sit in the SOF range but carry no frame size
		const lookalikes = [0xc4, 0xc8, 0xcc].flatMap((marker) => [
			0xff,
			marker,
			0x00,
			0x04,
			0x00,
			0x00
		]);
		// SOF2 (progressive): height 16, width 32
		const sof2 = [0xff, 0xc2, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x00, 0x00, 0x00];
		const jpeg = Buffer.from([0xff, 0xd8, ...lookalikes, ...sof2]);
		expect(imageInfo(jpeg)).toEqual({ mimeType: 'image/jpeg', width: 32, height: 16 });
	});

	it.each(['II', 'MM'] as const)(
		'swaps a JPEG’s dimensions when its EXIF (%s) turns it a quarter turn',
		(order) => {
			for (const orientation of [5, 6, 7, 8]) {
				expect(imageInfo(exifJpeg(orientation, order))).toEqual({
					mimeType: 'image/jpeg',
					width: 480,
					height: 640
				});
			}
			for (const orientation of [1, 2, 3, 4, 9]) {
				expect(imageInfo(exifJpeg(orientation, order))).toEqual({
					mimeType: 'image/jpeg',
					width: 640,
					height: 480
				});
			}
		}
	);

	it('ignores EXIF it can’t read', () => {
		// in no known byte order
		const unordered = exifJpeg(6);
		unordered.write('XX', 12, 'ascii');
		expect(imageInfo(unordered)?.width).toBe(640);
		// without an orientation
		const unoriented = exifJpeg(6);
		unoriented.writeUInt16LE(0x0110, 22);
		expect(imageInfo(unoriented)?.width).toBe(640);
		// pointing outside its own segment
		const broken = exifJpeg(6);
		broken.writeUInt32LE(0xffff, 16);
		expect(imageInfo(broken)?.width).toBe(640);
		// not EXIF at all, or too short to hold any
		const xmp = exifJpeg(6);
		xmp.write('XMP\0\0\0', 6, 'ascii');
		expect(imageInfo(xmp)?.width).toBe(640);
		const short = Buffer.from([
			0xff,
			0xd8,
			0xff,
			0xe1,
			0x00,
			0x08,
			...Buffer.from('Exif\0\0'),
			...SOF0
		]);
		expect(imageInfo(short)?.width).toBe(640);
	});

	it('returns null for anything else', () => {
		expect(imageInfo(Buffer.from('<svg></svg>'))).toBeNull();
		expect(imageInfo(Buffer.alloc(0))).toBeNull();
		// headers too short to hold dimensions
		expect(imageInfo(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
		expect(imageInfo(Buffer.from('GIF89a'))).toBeNull();
		expect(imageInfo(webp('VP8X').subarray(0, 30))).toBeNull();
		// a WebP chunk it doesn't know
		expect(imageInfo(webp('ALPH'))).toBeNull();
		// a JPEG whose segments go off the rails, or that ends before a frame
		expect(imageInfo(Buffer.from([0xff, 0xd8, 0x00, 0x00, ...Array(12).fill(0)]))).toBeNull();
		expect(
			imageInfo(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0, 0, 0, 0]))
		).toBeNull();
	});
});

describe('canonicalJson', () => {
	it('sorts keys at every depth and drops undefined', () => {
		expect(canonicalJson({ b: 1, a: [{ d: undefined, c: 'x' }], e: null })).toBe(
			'{"a":[{"c":"x"}],"b":1,"e":null}'
		);
		expect(canonicalJson({ b: 1, a: [{ d: undefined, c: 'x' }] })).toBe(
			canonicalJson({ a: [{ c: 'x' }], b: 1 })
		);
	});

	it('keeps array order and writes scalars as JSON does', () => {
		expect(canonicalJson([3, 'two', true, null, { z: 1, y: [] }])).toBe(
			'[3,"two",true,null,{"y":[],"z":1}]'
		);
		expect(canonicalJson('"quoted"')).toBe('"\\"quoted\\""');
		expect(canonicalJson(0)).toBe('0');
		expect(canonicalJson(undefined)).toBeUndefined();
	});
});
