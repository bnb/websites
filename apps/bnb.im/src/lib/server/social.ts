// Per-post social cover images (1200×630 PNG), the same card the site has
// always had: a pink bar, the title in Playfair Display, the description, then the
// author, date and site. satori lays it out as SVG and resvg rasterises it.
// The fonts come from Fontsource, so a build never downloads anything.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { readableDate } from '../dates';
import { HEIGHT, WIDTH } from '../social-size';

const ACCENT = '#ff0099';

const require = createRequire(import.meta.url);

type Weight = 400 | 700;

const FONT_FILES: Array<{ name: string; weight: Weight; files: string[] }> = [
	{
		name: 'Playfair Display',
		weight: 400,
		files: [
			'@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff',
			'@fontsource/playfair-display/files/playfair-display-latin-ext-400-normal.woff'
		]
	},
	{
		name: 'Lato',
		weight: 400,
		files: [
			'@fontsource/lato/files/lato-latin-400-normal.woff',
			'@fontsource/lato/files/lato-latin-ext-400-normal.woff'
		]
	},
	{
		name: 'Lato',
		weight: 700,
		files: [
			'@fontsource/lato/files/lato-latin-700-normal.woff',
			'@fontsource/lato/files/lato-latin-ext-700-normal.woff'
		]
	}
];

let fonts: Parameters<typeof satori>[1]['fonts'] | undefined;

function loadFonts() {
	fonts ??= FONT_FILES.flatMap(({ name, weight, files }) =>
		files.map((file) => ({
			name,
			weight,
			style: 'normal' as const,
			data: fs.readFileSync(require.resolve(file))
		}))
	);
	return fonts;
}

/** Cut at the last space before `max`, with an ellipsis. */
export function truncate(text: string | undefined, max: number): string {
	if (!text || text.length <= max) return text || '';
	return `${text.slice(0, text.lastIndexOf(' ', max))}…`;
}

interface CardData {
	title: string;
	description?: string;
	date: string;
}

// satori takes React-element-shaped plain objects, so no JSX needed
export function card({ title, description, date }: CardData) {
	return {
		type: 'div',
		props: {
			style: {
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				backgroundColor: '#ffffff',
				padding: '70px 80px 60px',
				fontFamily: 'Lato'
			},
			children: [
				{
					type: 'div',
					props: { style: { width: 140, height: 14, backgroundColor: ACCENT, marginBottom: 50 } }
				},
				{
					type: 'div',
					props: {
						style: {
							fontFamily: 'Playfair Display',
							fontSize: title.length > 70 ? 56 : 66,
							lineHeight: 1.2,
							color: '#000000'
						},
						children: title
					}
				},
				{
					type: 'div',
					props: {
						style: { fontSize: 30, lineHeight: 1.5, color: '#444444', marginTop: 30, flexGrow: 1 },
						children: truncate(description, 140)
					}
				},
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'baseline',
							fontSize: 30
						},
						children: [
							{
								type: 'div',
								props: {
									style: { display: 'flex', color: '#000000' },
									children: [
										{
											type: 'span',
											props: { style: { fontWeight: 700 }, children: 'Tierney Cyren' }
										},
										{
											type: 'span',
											props: { style: { color: '#666666', marginLeft: 20 }, children: date }
										}
									]
								}
							},
							{
								type: 'div',
								props: { style: { color: ACCENT, fontWeight: 700 }, children: 'bnb.im' }
							}
						]
					}
				}
			]
		}
	};
}

/** The PNG cover image for a post. */
export async function socialImage(post: {
	title: string;
	description?: string;
	date: Date;
}): Promise<Uint8Array<ArrayBuffer>> {
	const svg = await satori(
		card({
			title: truncate(post.title, 110),
			description: post.description,
			date: readableDate(post.date)
		}) as Parameters<typeof satori>[0],
		{ width: WIDTH, height: HEIGHT, fonts: loadFonts() }
	);
	// satori draws the text as paths, so resvg needs no fonts; loading the system ones took
	// most of each render
	return new Uint8Array(
		new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH }, font: { loadSystemFonts: false } })
			.render()
			.asPng()
	);
}
