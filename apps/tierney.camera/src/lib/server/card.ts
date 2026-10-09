// The share card (1200×630 PNG), set like the flyer: the name huge in heavy
// Archivo with the last name in acid, the featured photograph letterboxed under
// it with a mono caption, and the site in the corner. Without a photograph it's
// the name alone, set bigger. satori lays it out as SVG and resvg rasterises it,
// as bnb.im does for its post covers. The fonts come from Fontsource, inlined
// into the server build so the running server never reads them from
// node_modules (IBM Plex Mono is only a dev dependency). satori can't read woff2
// or a variable font's width axis, so the name is set in the static (normal
// width) 900 cut.
import archivo from '@fontsource/archivo/files/archivo-latin-900-normal.woff?inline';
import archivoExt from '@fontsource/archivo/files/archivo-latin-ext-900-normal.woff?inline';
import mono from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff?inline';
import monoExt from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-500-normal.woff?inline';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { nameLines } from '../format';
import { CARD_HEIGHT, CARD_WIDTH, SITE_NAME } from '../site';

const BG = '#0b0b0b';
const INK = '#f3f1ec';
const DIM = '#9c9a95';
const ACCENT = '#d7ff3a';
const PAD = 48;
/** Archivo's 900 cut runs about this wide per capital, in ems */
const CAPITAL_EM = 0.78;

type Fonts = Parameters<typeof satori>[1]['fonts'];
let fonts: Fonts | undefined;

/** A font from a ?inline import (a data: URL), as satori wants it. */
const font = (name: string, weight: 500 | 900, url: string) => ({
	name,
	weight,
	style: 'normal' as const,
	data: Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
});

// Each latin-ext cut is a family of its own, listed after its latin cut:
// satori only falls back to another font for a missing glyph (ƒ, say) across
// families, not between two cuts of one.
const DISPLAY = 'Archivo, Archivo Ext';
const MONO = 'IBM Plex Mono, IBM Plex Mono Ext';

const loadFonts = (): Fonts =>
	(fonts ??= [
		font('Archivo', 900, archivo),
		font('Archivo Ext', 900, archivoExt),
		font('IBM Plex Mono', 500, mono),
		font('IBM Plex Mono Ext', 500, monoExt)
	]);

export interface CardContent {
	name: string;
	/** the featured photograph as a data: URL, or null for a card in type alone */
	photo: string | null;
	/** under the photograph: where and when, then the exposure */
	caption: string[];
}

interface Element {
	type: string;
	props: { style?: Record<string, string | number>; children?: string | Element[]; src?: string };
}

const box = (style: Element['props']['style'], children: string | Element[]): Element => ({
	type: 'div',
	props: { style: { display: 'flex', ...style }, children }
});

/** Capitals, keeping ƒ lowercase (its capital is a hooked F that reads as a typo). */
const caps = (text: string) => text.toUpperCase().replaceAll('Ƒ', 'ƒ');

/** The biggest size, up to `max`, at which `letters` capitals fit across the card. */
export function nameSize(letters: number, max: number): number {
	return Math.min(max, Math.floor((CARD_WIDTH - 2 * PAD) / (letters * CAPITAL_EM)));
}

const root = {
	width: '100%',
	height: '100%',
	flexDirection: 'column',
	padding: PAD,
	backgroundColor: BG,
	fontFamily: DISPLAY,
	fontWeight: 900
};

/** The card as the element tree satori lays out (plain objects, so no JSX). */
export function card({ name, photo, caption }: CardContent): Element {
	const lines = nameLines(caps(name));
	// the last line takes the accent, as in the masthead
	const setLines = (size: number) =>
		lines.map((text, i) =>
			box(
				{
					fontSize: size,
					lineHeight: 0.8,
					letterSpacing: -0.02 * size,
					color: i === lines.length - 1 ? ACCENT : INK
				},
				text
			)
		);
	const footer = box(
		{ justifyContent: 'space-between', marginTop: 24, fontFamily: MONO, fontSize: 20 },
		[box({ color: DIM }, 'PHOTOGRAPHY'), box({ color: ACCENT }, caps(SITE_NAME))]
	);

	if (!photo) {
		// in type alone: one name per line, as big as the longer allows
		const size = nameSize(Math.max(...lines.map((text) => text.length)), 220);
		return box({ ...root, justifyContent: 'flex-end' }, [
			box({ flexDirection: 'column', gap: size * 0.12 }, setLines(size)),
			footer
		]);
	}

	// one line across the top: first name left, last name flush right
	const size = nameSize(lines.join(' ').length, 150);
	return box(root, [
		box({ justifyContent: 'space-between' }, setLines(size)),
		box({ position: 'relative', flexGrow: 1, marginTop: 32, overflow: 'hidden' }, [
			{
				type: 'img',
				props: { src: photo, style: { width: '100%', height: '100%', objectFit: 'cover' } }
			},
			box(
				{
					position: 'absolute',
					left: 0,
					bottom: 0,
					gap: 24,
					padding: '14px 20px',
					backgroundColor: BG,
					fontFamily: MONO,
					fontSize: 20
				},
				caption.map((text, i) => box({ color: i ? DIM : INK }, caps(text)))
			)
		]),
		footer
	]);
}

/** The share card as a PNG. */
export async function renderCard(content: CardContent): Promise<Uint8Array<ArrayBuffer>> {
	const svg = await satori(card(content) as Parameters<typeof satori>[0], {
		width: CARD_WIDTH,
		height: CARD_HEIGHT,
		fonts: loadFonts()
	});
	return new Uint8Array(
		new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH } }).render().asPng()
	);
}
