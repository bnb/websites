// Markdown → blocks the way a site does it: its own markdown-it parses the
// post, and the tokens (plus the source, for tables) go to tokensToBlocks.
import MarkdownIt from 'markdown-it';
import {
	tokensToBlocks,
	type Block,
	type ConvertOptions,
	type Facet,
	type ListBlock,
	type PendingBlock,
	type RichTextBlock
} from '../leaflet';

export const BASE_URL = 'https://example.com/posts/hello/';

export function convert(source: string, options: ConvertOptions = {}) {
	const breaks = options.breaks ?? false;
	const md = new MarkdownIt({ html: true, linkify: true, breaks });
	return tokensToBlocks(md.parse(source, {}), { baseUrl: BASE_URL, source, breaks, ...options });
}

/** A facet over bytes `byteStart`–`byteEnd`, from mark names or full features. */
export const facet = (
	byteStart: number,
	byteEnd: number,
	...features: Array<string | Facet['features'][number]>
): Facet => ({
	index: { byteStart, byteEnd },
	features: features.map((feature) =>
		typeof feature === 'string' ? { $type: `pub.leaflet.richtext.facet#${feature}` } : feature
	)
});

export const link = (uri: string) => ({ $type: 'pub.leaflet.richtext.facet#link', uri });

// narrowing for the block kinds a test expects
export const text = (block: Block | undefined) => block as RichTextBlock;
export const list = (block: Block | undefined) => block as ListBlock;
export const pending = (block: Block | undefined) => block as PendingBlock;

/** What a list's items say, one level down. */
export const itemText = (items: ListBlock['children'] | undefined) =>
	(items ?? []).map((item) => item.content.plaintext);

/** Each block's text, or `[pending src]` for a placeholder. */
export const texts = (blocks: Block[]) =>
	blocks.map((block) =>
		'pending' in block ? `[${block.pending} ${block.src ?? block.url}]` : text(block).plaintext
	);
