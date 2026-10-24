import { unreadableFonts } from '@bnb/testing/satori';
import { describe, expect, it } from 'vitest';
import { HEIGHT, WIDTH } from '../social-size';
import { card, loadFonts, socialImage, truncate } from './social';

interface Node {
	type: string;
	props: { style: Record<string, unknown>; children?: string | Node[] };
}

const parts = (data: Parameters<typeof card>[0]) => {
	const [bar, title, description, footer] = (card(data) as Node).props.children as Node[];
	return { bar, title, description, footer };
};

describe('truncate', () => {
	it('leaves short text alone', () => {
		expect(truncate('Short and sweet', 140)).toBe('Short and sweet');
		expect(truncate('exactly ten', 11)).toBe('exactly ten');
	});

	it('cuts at the last space before the limit, with an ellipsis', () => {
		expect(truncate('The quick brown fox jumps', 12)).toBe('The quick…');
		expect(truncate('The quick brown fox jumps', 9)).toBe('The quick…');
		expect(truncate('one two three', 12)).toBe('one two…');
	});

	it('gives an empty string for nothing', () => {
		expect(truncate(undefined, 10)).toBe('');
		expect(truncate('', 10)).toBe('');
	});
});

describe('card', () => {
	const date = '02 Oct 2026';

	it('sets the title, description, author, date and site', () => {
		const { bar, title, description, footer } = parts({
			title: 'What is the Atmosphere',
			description: 'An introduction.',
			date
		});
		expect(bar.props.style).toMatchObject({ backgroundColor: '#ff0099' });
		expect(title.props.children).toBe('What is the Atmosphere');
		expect(title.props.style.fontFamily).toBe('Playfair Display');
		expect(description.props.children).toBe('An introduction.');

		const [byline, site] = footer.props.children as Node[];
		const [name, when] = byline.props.children as Node[];
		expect(name.props.children).toBe('Tierney Cyren');
		expect(when.props.children).toBe(date);
		expect(site.props.children).toBe('bnb.im');
	});

	it('sets titles over 70 characters smaller', () => {
		expect(parts({ title: 'x'.repeat(70), date }).title.props.style.fontSize).toBe(66);
		expect(parts({ title: 'x'.repeat(71), date }).title.props.style.fontSize).toBe(56);
	});

	it('truncates the description to 140 characters', () => {
		const long = `${'word '.repeat(40)}end`;
		const text = parts({ title: 'T', description: long, date }).description.props.children;
		expect(text).toBe(`${'word '.repeat(27)}word…`);
		expect((text as string).length).toBeLessThanOrEqual(141);
	});

	it('copes with no description', () => {
		expect(parts({ title: 'T', date }).description.props.children).toBe('');
	});
});

describe('socialImage', () => {
	const u32 = (png: Uint8Array, offset: number) =>
		new DataView(png.buffer, png.byteOffset).getUint32(offset);

	it('renders a 1200×630 PNG', async () => {
		const png = await socialImage({
			title: 'Jest and the `--changedSince` flag in GitHub Actions CI',
			description: "Today I worked through getting Jest's --changedSince flag working.",
			date: new Date('2020-04-09')
		});

		expect(png).toBeInstanceOf(Uint8Array);
		// the PNG signature, then the IHDR chunk with the size
		expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		expect(new TextDecoder().decode(png.subarray(12, 16))).toBe('IHDR');
		expect(u32(png, 16)).toBe(WIDTH);
		expect(u32(png, 20)).toBe(HEIGHT);
		expect([WIDTH, HEIGHT]).toEqual([1200, 630]);
		expect(png.length).toBeGreaterThan(5000);
	});

	it('renders a long title and no description', async () => {
		const png = await socialImage({
			title: 'A very long title that goes on and on '.repeat(5),
			date: new Date('2019-04-15')
		});
		expect(u32(png, 16)).toBe(1200);
		expect(u32(png, 20)).toBe(630);
	});
});

describe('loadFonts', () => {
	it('gives satori fonts it draws, not as missing-glyph boxes', async () => {
		await expect(unreadableFonts(loadFonts())).resolves.toEqual([]);
	});
});
