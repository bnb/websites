import { createHash } from 'node:crypto';

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

/**
 * The CIDv1 (raw codec, sha2-256) the PDS addresses a blob by, so whether it
 * already holds an image can be checked without uploading it.
 */
export function blobCid(bytes: Buffer): string {
	const digest = createHash('sha256').update(bytes).digest();
	const cid = Buffer.concat([Buffer.from([0x01, 0x55, 0x12, 0x20]), digest]);
	let bits = 0;
	let buffer = 0;
	let out = 'b';
	for (const byte of cid) {
		buffer = (buffer << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += BASE32[(buffer >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
	return out;
}

export interface ImageInfo {
	mimeType: string;
	width: number;
	height: number;
}

/**
 * Mime type and pixel dimensions from the file header, enough for the image
 * formats a blog post realistically holds. Null for anything else.
 */
export function imageInfo(bytes: Buffer): ImageInfo | null {
	if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) {
		return { mimeType: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
	}
	if (bytes.length > 10 && bytes.toString('ascii', 0, 4) === 'GIF8') {
		return { mimeType: 'image/gif', width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
	}
	if (
		bytes.length > 30 &&
		bytes.toString('ascii', 0, 4) === 'RIFF' &&
		bytes.toString('ascii', 8, 12) === 'WEBP'
	) {
		const chunk = bytes.toString('ascii', 12, 16);
		if (chunk === 'VP8 ') {
			return {
				mimeType: 'image/webp',
				width: bytes.readUInt16LE(26) & 0x3fff,
				height: bytes.readUInt16LE(28) & 0x3fff
			};
		}
		if (chunk === 'VP8L') {
			const bits = bytes.readUInt32LE(21);
			return {
				mimeType: 'image/webp',
				width: (bits & 0x3fff) + 1,
				height: ((bits >> 14) & 0x3fff) + 1
			};
		}
		if (chunk === 'VP8X') {
			return {
				mimeType: 'image/webp',
				width: bytes.readUIntLE(24, 3) + 1,
				height: bytes.readUIntLE(27, 3) + 1
			};
		}
	}
	if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
		let offset = 2;
		let rotated = false;
		while (offset + 9 < bytes.length) {
			if (bytes[offset] !== 0xff) return null;
			const marker = bytes[offset + 1];
			const length = bytes.readUInt16BE(offset + 2);
			if (marker === 0xe1) {
				rotated ||= exifRotated(bytes, offset + 4, Math.min(offset + 2 + length, bytes.length));
			}
			// SOF markers carry the frame size; C4, C8, and CC are look-alikes that don't
			if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
				const width = bytes.readUInt16BE(offset + 7);
				const height = bytes.readUInt16BE(offset + 5);
				return {
					mimeType: 'image/jpeg',
					width: rotated ? height : width,
					height: rotated ? width : height
				};
			}
			offset += 2 + length;
		}
	}
	return null;
}

// whether a JPEG's EXIF orientation (an APP1 segment between `start` and
// `end`) turns it a quarter turn, so it displays with width and height
// swapped. phone photos are usually stored sideways like this.
function exifRotated(bytes: Buffer, start: number, end: number): boolean {
	if (end - start < 14 || bytes.toString('ascii', start, start + 6) !== 'Exif\0\0') return false;
	const tiff = start + 6;
	const order = bytes.toString('ascii', tiff, tiff + 2);
	if (order !== 'II' && order !== 'MM') return false;
	const u16 = (at: number) => (order === 'II' ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at));
	const u32 = (at: number) => (order === 'II' ? bytes.readUInt32LE(at) : bytes.readUInt32BE(at));
	const ifd = tiff + u32(tiff + 4);
	if (ifd + 2 > end) return false;
	const entries = ifd + 2 + u16(ifd) * 12;
	for (let entry = ifd + 2; entry < entries && entry + 12 <= end; entry += 12) {
		// 0x0112 is Orientation; 5 through 8 are the transposed ones
		if (u16(entry) === 0x0112) {
			const orientation = u16(entry + 8);
			return orientation >= 5 && orientation <= 8;
		}
	}
	return false;
}

/**
 * JSON with sorted keys and undefined dropped, so a record built here can be
 * compared against the copy the PDS hands back.
 */
export function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.toSorted()
			.filter((key) => record[key] !== undefined)
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
			.join(',')}}`;
	}
	return JSON.stringify(value);
}
