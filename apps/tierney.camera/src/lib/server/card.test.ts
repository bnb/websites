import { unreadableFonts } from '@bnb/testing/satori';
import { describe, expect, it } from 'vitest';
import { card, loadFonts, nameSize } from './card';

interface Node {
	type: string;
	props: { style?: Record<string, unknown>; children?: string | Node[]; src?: string };
}

const children = (node: Node) => node.props.children as Node[];
/** Every piece of text on the card, with its colour. */
function texts(node: Node): Array<[string, unknown]> {
	const { children: inner, style } = node.props;
	if (typeof inner === 'string') return [[inner, style?.color]];
	return (inner ?? []).flatMap(texts);
}

const PHOTO = 'data:image/jpeg;base64,AAAA';

describe('share card', () => {
	it('sets the name in capitals, last name in acid, over the photograph and its caption', () => {
		const tree = card({
			name: 'tierney cyren',
			photo: PHOTO,
			caption: ['Bushwick, NY · 08.20.26', '50mm ƒ/1.4 1/30 ISO 2000']
		}) as Node;
		const [name, frame, footer] = children(tree);

		expect(texts(name)).toEqual([
			['TIERNEY', '#f3f1ec'],
			['CYREN', '#d7ff3a']
		]);
		const [img] = children(frame);
		expect(img).toMatchObject({ type: 'img', props: { src: PHOTO } });
		// ƒ stays lowercase in the capitals
		expect(texts(frame).map(([text]) => text)).toEqual([
			'BUSHWICK, NY · 08.20.26',
			'50MM ƒ/1.4 1/30 ISO 2000'
		]);
		expect(texts(footer)).toEqual([
			['PHOTOGRAPHY', '#9c9a95'],
			['TIERNEY.CAMERA', '#d7ff3a']
		]);
	});

	it('sets the name alone, bigger, when there is no photograph', () => {
		const withPhoto = card({ name: 'tierney cyren', photo: PHOTO, caption: [] }) as Node;
		const tree = card({ name: 'tierney cyren', photo: null, caption: [] }) as Node;

		expect(JSON.stringify(tree)).not.toContain('"img"');
		const [name] = children(tree);
		expect(texts(name).map(([text]) => text)).toEqual(['TIERNEY', 'CYREN']);
		const size = (node: Node) => children(children(node)[0])[0].props.style?.fontSize as number;
		expect(size(tree)).toBeGreaterThan(size(withPhoto));
	});

	it('gives a one-word name the accent', () => {
		const tree = card({ name: 'cyren', photo: null, caption: [] }) as Node;
		expect(texts(children(tree)[0])).toEqual([['CYREN', '#d7ff3a']]);
	});
});

describe('nameSize', () => {
	it('shrinks a longer name to fit across the card, up to a cap', () => {
		expect(nameSize(13, 150)).toBe(108);
		expect(nameSize(26, 150)).toBe(54);
		expect(nameSize(3, 150)).toBe(150);
	});
});

describe('loadFonts', () => {
	it('gives satori fonts it draws, not as missing-glyph boxes', async () => {
		await expect(unreadableFonts(loadFonts())).resolves.toEqual([]);
	});
});
