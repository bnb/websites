import { describe, expect, it, vi } from 'vitest';
import { card, fetchCover, renderCard } from './card';

interface Node {
	type: string;
	props: { style?: Record<string, unknown>; children?: string | Node[]; src?: string };
}

/** Every string in the card, in order. */
const words = (node: Node | string): string[] =>
	typeof node === 'string'
		? [node]
		: [node.props.children ?? []].flat().flatMap((child) => words(child as Node | string));

/** Every element of a type in the card. */
const all = (node: Node, type: string): Node[] => [
	...(node.type === type ? [node] : []),
	...(Array.isArray(node.props.children)
		? node.props.children.flatMap((child) => all(child, type))
		: [])
];

/** A 1×1 PNG. */
const PIXEL = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
	'base64'
);

const u32 = (png: Uint8Array, offset: number) =>
	new DataView(png.buffer, png.byteOffset).getUint32(offset);

describe('card', () => {
	it('sets the name, the mix count and the site, over the cover as a record label', () => {
		const tree = card({
			cover: 'data:image/png;base64,AAAA',
			summary: '2 mixes · 1 hr 19 min'
		}) as Node;
		expect(words(tree)).toEqual([
			'DJ',
			'TIERNEY',
			'CYREN',
			'2 MIXES · 1 HR 19 MIN',
			'TIERNEYCYREN.COM'
		]);
		expect(all(tree, 'img').map((img) => img.props.src)).toEqual(['data:image/png;base64,AAAA']);
	});

	it('draws a plain label without a cover, and leaves out an empty summary', () => {
		const tree = card({ cover: null, summary: '' }) as Node;
		expect(all(tree, 'img')).toEqual([]);
		expect(words(tree)).toEqual(['DJ', 'TIERNEY', 'CYREN', 'TIERNEYCYREN.COM']);
	});
});

describe('renderCard', () => {
	it('renders a 1200×630 PNG, with or without a cover', async () => {
		for (const cover of [`data:image/png;base64,${PIXEL.toString('base64')}`, null]) {
			const png = await renderCard({ cover, summary: '2 mixes · 1 hr 19 min' });
			expect([...png.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
			expect([u32(png, 16), u32(png, 20)]).toEqual([1200, 630]);
		}
	});
});

describe('fetchCover', () => {
	const respond = (body: BodyInit | null, init: ResponseInit) =>
		vi.fn(async () => new Response(body, init)) as unknown as typeof fetch;

	it('returns a JPEG or PNG cover as a data URL', async () => {
		const fetchFn = respond(PIXEL, { headers: { 'content-type': 'image/png' } });
		await expect(fetchCover('https://images.example/cover', fetchFn)).resolves.toBe(
			`data:image/png;base64,${PIXEL.toString('base64')}`
		);
	});

	it('gives null for anything satori can’t draw, a failed response or a network error', async () => {
		const webp = respond(PIXEL, { headers: { 'content-type': 'image/webp' } });
		const untyped = respond(PIXEL, {});
		const missing = respond('gone', { status: 404, headers: { 'content-type': 'image/png' } });
		const offline = vi.fn(async () => {
			throw new TypeError('fetch failed');
		}) as unknown as typeof fetch;
		for (const fetchFn of [webp, untyped, missing, offline]) {
			await expect(fetchCover('https://images.example/cover', fetchFn)).resolves.toBeNull();
		}
	});
});
