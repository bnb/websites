// The share card (a 1200×630 PNG for Open Graph and Twitter) in the Laser
// style: laser fans on UV black, the name huge in condensed type, the newest
// mix's cover as the label of a record, and the mix count. satori lays it out
// as SVG and resvg rasterises it, as bnb.im's post covers do. The fonts are
// inlined into the server build, so the running server never reads them from
// node_modules (IBM Plex Mono is only a dev dependency).
import narrowFont from '@fontsource/archivo-narrow/files/archivo-narrow-latin-700-normal.woff?inline';
import monoFont from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff?inline';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

const WIDTH = 1200;
const HEIGHT = 630;

const BG = '#0c0716';
const INK = '#f4efff';
const DIM = '#a99cc4';
const CYAN = '#00f0ff';
const MAGENTA = '#ff3df2';

/** the record, off the right edge, and its label */
const RECORD = { x: 680, y: 35, size: 560 };
const LABEL = 320;

/** cover formats satori can draw */
const COVER_TYPES = new Set(['image/jpeg', 'image/png']);

type Element = Parameters<typeof satori>[0];
type Fonts = Parameters<typeof satori>[1]['fonts'];

/** A `data:` URL (from a ?inline import) as bytes. */
const bytes = (url: string) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

let fonts: Fonts | undefined;
const loadFonts = (): Fonts =>
	(fonts ??= [
		{ name: 'Archivo Narrow', weight: 700, style: 'normal', data: bytes(narrowFont) },
		{ name: 'IBM Plex Mono', weight: 500, style: 'normal', data: bytes(monoFont) }
	]);

const node = (type: string, props: Record<string, unknown>) => ({ type, props });

/** Lines fanning out from a point off the canvas, like the masthead's lasers. */
function fan(x: number, y: number, from: number, to: number, color: string) {
	return Array.from({ length: 12 }, (_, i) => {
		const angle = ((from + ((to - from) * i) / 11) * Math.PI) / 180;
		return node('line', {
			x1: x,
			y1: y,
			x2: Math.round(x + Math.cos(angle) * 1800),
			y2: Math.round(y - Math.sin(angle) * 1800),
			stroke: color,
			strokeWidth: 2,
			strokeOpacity: 0.32
		});
	});
}

/** satori takes React-element-shaped plain objects, so no JSX needed. */
export function card({ cover, summary }: { cover: string | null; summary: string }) {
	const middle = RECORD.size / 2;
	const grooves = Array.from({ length: 18 }, (_, i) =>
		node('circle', {
			cx: middle,
			cy: middle,
			r: LABEL / 2 + 12 + i * 6,
			fill: 'none',
			stroke: '#ffffff',
			strokeOpacity: i === 0 ? 0.14 : 0.05
		})
	);
	const label = cover
		? node('img', {
				src: cover,
				width: LABEL,
				height: LABEL,
				style: { position: 'absolute', borderRadius: LABEL / 2, objectFit: 'cover' }
			})
		: node('div', {
				style: {
					position: 'absolute',
					width: LABEL,
					height: LABEL,
					borderRadius: LABEL / 2,
					backgroundImage: `linear-gradient(135deg, ${CYAN}, ${MAGENTA})`
				}
			});

	return node('div', {
		style: {
			position: 'relative',
			display: 'flex',
			width: '100%',
			height: '100%',
			backgroundColor: BG,
			color: INK,
			fontFamily: 'IBM Plex Mono'
		},
		children: [
			node('svg', {
				width: WIDTH,
				height: HEIGHT,
				viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
				style: { position: 'absolute', left: 0, top: 0 },
				children: [...fan(-90, 720, 20, 88, CYAN), ...fan(1290, 720, 98, 168, MAGENTA)]
			}),
			node('div', {
				style: {
					position: 'absolute',
					left: RECORD.x,
					top: RECORD.y,
					width: RECORD.size,
					height: RECORD.size,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					borderRadius: middle,
					backgroundColor: '#07040d',
					boxShadow: `0 0 60px rgba(0, 240, 255, 0.25)`
				},
				children: [
					node('svg', {
						width: RECORD.size,
						height: RECORD.size,
						style: { position: 'absolute', left: 0, top: 0 },
						children: grooves
					}),
					label,
					node('div', {
						style: {
							position: 'absolute',
							width: 18,
							height: 18,
							borderRadius: 9,
							backgroundColor: BG
						}
					})
				]
			}),
			node('div', {
				style: {
					position: 'absolute',
					left: 72,
					top: 64,
					bottom: 60,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					alignItems: 'flex-start'
				},
				children: [
					node('div', {
						style: {
							padding: '6px 16px',
							backgroundColor: MAGENTA,
							color: BG,
							fontSize: 26
						},
						children: 'DJ'
					}),
					node('div', {
						style: {
							display: 'flex',
							flexDirection: 'column',
							fontFamily: 'Archivo Narrow',
							fontSize: 196,
							lineHeight: 0.8,
							letterSpacing: -3,
							textShadow: '0 0 28px rgba(0, 240, 255, 0.45)'
						},
						children: [
							node('div', { children: 'TIERNEY' }),
							node('div', { style: { color: CYAN }, children: 'CYREN' })
						]
					}),
					node('div', {
						style: { display: 'flex', gap: 28, fontSize: 24, letterSpacing: 2 },
						children: [
							...(summary
								? [node('div', { style: { color: DIM }, children: summary.toUpperCase() })]
								: []),
							node('div', { style: { color: CYAN }, children: 'TIERNEYCYREN.COM' })
						]
					})
				]
			})
		]
	});
}

/** The card as a PNG. `cover` is a data URL, or null for the type-only card. */
export async function renderCard(
	data: Parameters<typeof card>[0]
): Promise<Uint8Array<ArrayBuffer>> {
	const svg = await satori(card(data) as Element, {
		width: WIDTH,
		height: HEIGHT,
		fonts: loadFonts()
	});
	// satori draws the text as paths, so resvg needs no fonts; loading the system ones took
	// most of each render
	return new Uint8Array(
		new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH }, font: { loadSystemFonts: false } })
			.render()
			.asPng()
	);
}

/** A cover as a data URL satori can draw (JPEG or PNG), or null when it can't be had. */
export async function fetchCover(url: string, fetchFn: typeof fetch): Promise<string | null> {
	try {
		const response = await fetchFn(url, { headers: { accept: 'image/jpeg,image/png' } });
		const type = response.headers.get('content-type')?.split(';')[0] ?? '';
		if (!response.ok || !COVER_TYPES.has(type)) return null;
		return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
	} catch {
		return null;
	}
}
