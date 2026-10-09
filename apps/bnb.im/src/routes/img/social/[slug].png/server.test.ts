import { isHttpError } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { GET, entries, prerender } from './+server';

type RequestEvent = Parameters<typeof GET>[0];

const get = async (slug: string) => GET({ params: { slug } } as RequestEvent);

describe('GET /img/social/[slug].png', () => {
	it('prerenders a cover image for every post', async () => {
		expect(prerender).toBe(true);
		const slugs = (await entries()).map(({ slug }) => slug);
		expect(slugs).toHaveLength(14);
		expect(slugs).toContain('is-mdm');
	});

	it("serves the post's cover image as a 1200×630 PNG", async () => {
		const response = await get('is-mdm');
		expect(response.headers.get('content-type')).toBe('image/png');

		const png = new Uint8Array(await response.arrayBuffer());
		expect(Array.from(png.subarray(1, 4), (byte) => String.fromCodePoint(byte)).join('')).toBe(
			'PNG'
		);
		const view = new DataView(png.buffer);
		expect(view.getUint32(16)).toBe(1200);
		expect(view.getUint32(20)).toBe(630);
	});

	it('is a 404 for a post that does not exist', async () => {
		const error = await get('no-such-post').catch((thrown: unknown) => thrown);
		expect(isHttpError(error, 404)).toBe(true);
	});
});
