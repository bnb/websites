import satori, { type Font } from 'satori';

/** Basic Latin and Latin Extended-A letters, so a Fontsource latin-ext cut has some of its own. */
const LETTERS = ['I', 'O', 'Ā', 'ł'];

const draw = (font: Font, text: string) =>
	satori(
		{
			type: 'div',
			props: { style: { fontFamily: font.name, fontWeight: font.weight }, children: text }
		},
		{ width: 200, height: 100, fonts: [font] }
	);

/**
 * The fonts satori draws only as .notdef, the same box for every character, so
 * the card's text would come out as tofu. A font counts as read when any two of
 * the letters draw differently.
 */
export async function unreadableFonts(fonts: Font[]): Promise<string[]> {
	const unreadable: string[] = [];
	for (const font of fonts) {
		const drawn = new Set(await Promise.all(LETTERS.map((letter) => draw(font, letter))));
		if (drawn.size === 1) unreadable.push(`${font.name} ${font.weight}`);
	}
	return unreadable;
}
