import { createHash } from 'node:crypto';

const S32 = '234567abcdefghijklmnopqrstuvwxyz';

/**
 * A TID derived from a post's date and a key (its slug): 53 bits of
 * microseconds since the epoch plus a 10 bit clock id from a hash of the key,
 * in sortable base32. A new post's at:// URI is then known at build time,
 * before its record exists, so the page can link to it on the first build.
 * `bump` moves the clock id along when two posts would collide.
 */
export function deterministicTid(date: Date, key: string, bump = 0): string {
	const micros = BigInt(date.getTime()) * 1000n;
	const clockId = (createHash('sha256').update(key).digest().readUInt16BE(0) + bump) % 1024;
	let value = (micros << 10n) | BigInt(clockId);
	let tid = '';
	for (let i = 0; i < 13; i++) {
		tid = S32[Number(value & 31n)] + tid;
		value >>= 5n;
	}
	return tid;
}
