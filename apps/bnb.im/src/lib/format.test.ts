import { describe, expect, it } from 'vitest';
import { displayTags, pad2, readingTime, wordCount } from './format';

describe('pad2', () => {
	it('zero-pads single digits', () => {
		expect(pad2(7)).toBe('07');
		expect(pad2('3')).toBe('03');
		expect(pad2(0)).toBe('00');
	});

	it('leaves two or more digits alone', () => {
		expect(pad2(14)).toBe('14');
		expect(pad2(123)).toBe('123');
	});

	it('pads an empty part to 00', () => {
		expect(pad2('')).toBe('00');
	});
});

describe('readingTime', () => {
	const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

	it('reads at roughly 230 words a minute', () => {
		expect(readingTime(words(230))).toBe(1);
		expect(readingTime(words(460))).toBe(2);
		expect(readingTime(words(2300))).toBe(10);
		// rounds to the nearest minute
		expect(readingTime(words(574))).toBe(2);
		expect(readingTime(words(576))).toBe(3);
	});

	it('takes at least a minute, even for nothing', () => {
		expect(readingTime('')).toBe(1);
		expect(readingTime('<p>hi</p>')).toBe(1);
	});

	it('counts words, not tags or attributes', () => {
		const html = `<p class="a b c d e f">${words(230)}</p>`.repeat(2);
		expect(readingTime(html)).toBe(2);
		// tags separate words, so adjacent elements don't run together
		expect(readingTime(`${'<b>x</b><i>y</i>'.repeat(230)}`)).toBe(2);
	});

	it('ignores runs of whitespace', () => {
		expect(readingTime(`  \n\t${words(230).replaceAll(' ', '   \n ')}  `)).toBe(1);
	});
});

describe('wordCount', () => {
	it('counts the words a reader sees, not markup', () => {
		expect(wordCount('<p class="a b">Hello <em>there</em> reader.</p>\n<p>Two</p>')).toBe(4);
		expect(wordCount('')).toBe(0);
	});
});

describe('displayTags', () => {
	it('drops the post collection tag', () => {
		expect(displayTags(['post', 'javascript', 'node'])).toEqual(['javascript', 'node']);
	});

	it('strips the stray trailing commas some front matter has', () => {
		expect(displayTags(['post', 'node', 'webdev,', 'opensource'])).toEqual([
			'node',
			'webdev',
			'opensource'
		]);
	});

	it('trims whitespace and drops empty tags', () => {
		expect(displayTags([' node ', '', ',', 'post'])).toEqual(['node']);
	});

	it('copes with no tags', () => {
		expect(displayTags()).toEqual([]);
		expect(displayTags([])).toEqual([]);
	});
});
