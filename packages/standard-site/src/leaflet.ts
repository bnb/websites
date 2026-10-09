// Turns a post's Markdown into pub.leaflet.content blocks, which standard.site
// readers like upvote.at and leaflet.pub render as rich text. It works from
// markdown-it's token stream: the site hands over the tokens its own
// markdown-it made, so the record says exactly what the page shows.
import { decodeHTML } from 'entities';

const BLOCK = 'pub.leaflet.pages.linearDocument#block';
const TEXT = 'pub.leaflet.blocks.text';
const CODE = 'pub.leaflet.blocks.code';
const FACET = 'pub.leaflet.richtext.facet';
const MARKS = ['bold', 'italic', 'code', 'strikethrough'] as const;

type Mark = (typeof MARKS)[number];

/** The parts of a markdown-it token the converter reads. */
export interface MarkdownToken {
	type: string;
	tag: string;
	content: string;
	info: string;
	level: number;
	nesting: number;
	map: [number, number] | null;
	children: MarkdownToken[] | null;
	/** markdown-it's types allow numbers too (for ordered lists' `start`) */
	attrGet(name: string): string | number | null;
}

export interface Facet {
	index: { byteStart: number; byteEnd: number };
	features: Array<{ $type: string; uri?: string }>;
}

export interface RichTextBlock {
	$type: string;
	plaintext: string;
	facets?: Facet[];
	/** headers */
	level?: number;
	/** code */
	language?: string;
}

export interface ListItem {
	$type: string;
	content: RichTextBlock;
	children?: ListItem[];
	orderedListChildren?: ListBlock;
	unorderedListChildren?: ListBlock;
}

export interface ListBlock {
	$type: string;
	children: ListItem[];
	startIndex?: number;
}

/** An image or a Bluesky post, which needs the network before it's a finished block. */
export interface PendingBlock {
	pending: 'image' | 'bskyPost';
	/** the image's src as written, or the post's URL */
	src?: string;
	url: string;
	alt?: string;
	/** a link to fall back on when it can't be resolved */
	fallback: RichTextBlock;
}

export type Block =
	| RichTextBlock
	| ListBlock
	| PendingBlock
	| { $type: 'pub.leaflet.blocks.horizontalRule' };

// whether two runs of text carry the same link and marks
const sameFormat = (a: Run, b: Run) =>
	a.link === b.link && MARKS.every((mark) => a[mark] === b[mark]);

const BSKY_POST_URL = /^https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([a-z0-9]+)\/?$/;

// elements whose contents aren't text a reader sees on the page
const HIDDEN = 'script|style|template|noscript|svg|math';
const HIDDEN_ELEMENT = new RegExp(`<(${HIDDEN})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi');
const HIDDEN_OPEN = new RegExp(`^<(?:${HIDDEN})\\b(?![^>]*\\/>)`, 'i');
const HIDDEN_CLOSE = new RegExp(`^<\\/(?:${HIDDEN})\\s*>`, 'i');

// tags that start a new paragraph of text
const BLOCK_TAG =
	/<\/?(?:address|article|aside|blockquote|caption|dd|details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|section|summary|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

const IMG = /^<img\b/i;
const BR = /^<br\s*\/?>$/i;
const BR_ANY = /<br\s*\/?>/gi;
const TAG = /<[^>]*>/g;
const WHITESPACE = /\s+/g;
const PARAGRAPH_BREAK = /\n[ \n]*\n/;
const SPACED_NEWLINE = / *\n */g;
const COMMENT = /<!--[\s\S]*?-->/g;
const PRE_OR_IMG = /(<pre\b[^>]*>[\s\S]*?<\/pre\s*>|<img\b[^>]*>)/i;
const LEADING_NEWLINE = /^\r?\n/;
const TRAILING_NEWLINE = /\n$/;
const TRAILING_SLASH = /\/$/;
const SPACES = / {2,}/g;
const LEADING_SPACE = /^ /;
const OPEN_SUFFIX = /_open$/;
const SPACE_RUN = /\s+/;

const attributePatterns = new Map<string, RegExp>();

// a token's attribute as text
const attr = (token: MarkdownToken, name: string): string | null => {
	const value = token.attrGet(name);
	return value === null ? null : String(value);
};

// an attribute's value from an HTML tag, entities decoded
function attribute(tag: string, name: string): string | undefined {
	let pattern = attributePatterns.get(name);
	if (!pattern) {
		pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`, 'i');
		attributePatterns.set(name, pattern);
	}
	const match = pattern.exec(tag);
	return match ? decodeHTML(match[1] ?? match[2] ?? match[3]) : undefined;
}

// the paragraphs of text a fragment of HTML shows. whitespace collapses the
// way a browser collapses it, and <br> is a line break.
const htmlParagraphs = (html: string) =>
	decodeHTML(
		html.replace(WHITESPACE, ' ').replace(BR_ANY, '\n').replace(BLOCK_TAG, '\n\n').replace(TAG, '')
	)
		.split(PARAGRAPH_BREAK)
		.map((text) => text.replace(SPACED_NEWLINE, '\n').trim())
		.filter(Boolean);

interface Run extends Record<Mark, boolean> {
	text: string;
	link?: string;
}

// accumulates runs of text with the marks active when they were added, then
// flattens them into plaintext plus non-overlapping facets. facet offsets
// index into the UTF-8 bytes of the text, not the JS string.
class RichText {
	runs: Run[] = [];
	depth: Record<Mark, number> = { bold: 0, italic: 0, code: 0, strikethrough: 0 };
	links: Array<string | undefined> = [];
	// inside something a reader doesn't see, like an inline <svg>
	hidden = 0;
	hiddenLinks: number[] = [];

	get empty() {
		return this.runs.every((run) => !run.text.trim());
	}

	push(text: string, extra: Partial<Record<Mark, boolean>> = {}) {
		if (!text || this.hidden) return;
		const run = { text, link: this.links.at(-1) } as Run;
		for (const mark of MARKS) run[mark] = this.depth[mark] > 0 || !!extra[mark];
		this.runs.push(run);
	}

	separate(separator: string) {
		if (!this.empty) this.push(separator);
	}

	open(mark: Mark) {
		this.depth[mark]++;
	}

	close(mark: Mark) {
		this.depth[mark] = Math.max(0, this.depth[mark] - 1);
	}

	build(): { plaintext: string; facets?: Facet[] } {
		const runs = this.runs.map((run) => ({ ...run }));
		// trim the edges of the whole text, not each run
		while (runs.length && !runs[0].text.trimStart()) runs.shift();
		while (runs.length && !runs.at(-1)!.text.trimEnd()) runs.pop();
		if (runs.length) {
			runs[0].text = runs[0].text.trimStart();
			runs.at(-1)!.text = runs.at(-1)!.text.trimEnd();
		}

		const merged: Run[] = [];
		for (const run of runs) {
			const last = merged.at(-1);
			if (last && sameFormat(last, run)) last.text += run.text;
			else merged.push(run);
		}

		// runs of spaces collapse the way they do on the page, except in code
		let afterSpace = false;
		for (const run of merged) {
			if (!run.code) {
				run.text = run.text.replace(SPACES, ' ');
				if (afterSpace) run.text = run.text.replace(LEADING_SPACE, '');
			}
			if (run.code || run.text) afterSpace = !run.code && run.text.endsWith(' ');
		}

		let plaintext = '';
		let byte = 0;
		const facets: Facet[] = [];
		for (const run of merged) {
			const length = Buffer.byteLength(run.text, 'utf8');
			const features: Facet['features'] = [];
			if (run.link) features.push({ $type: `${FACET}#link`, uri: run.link });
			for (const mark of MARKS) {
				if (run[mark]) features.push({ $type: `${FACET}#${mark}` });
			}
			if (features.length && length) {
				facets.push({ index: { byteStart: byte, byteEnd: byte + length }, features });
			}
			plaintext += run.text;
			byte += length;
		}

		return facets.length ? { plaintext, facets } : { plaintext };
	}
}

// index of the token that closes the one at `start`
function closing(tokens: MarkdownToken[], start: number): number {
	const open = tokens[start];
	const type = open.type.replace(OPEN_SUFFIX, '_close');
	for (let i = start + 1; i < tokens.length; i++) {
		if (tokens[i].type === type && tokens[i].level === open.level) return i;
	}
	throw new Error(`Unclosed ${open.type}`);
}

const MARK_TOKENS: Record<string, [Mark, 'open' | 'close']> = {
	strong_open: ['bold', 'open'],
	strong_close: ['bold', 'close'],
	em_open: ['italic', 'open'],
	em_close: ['italic', 'close'],
	s_open: ['strikethrough', 'open'],
	s_close: ['strikethrough', 'close']
};

class Converter {
	lines: string[];
	baseUrl?: string;
	blueskyPosts: boolean;
	breaks: boolean;

	constructor({ source, baseUrl, blueskyPosts, breaks }: ConvertOptions) {
		this.lines = (source ?? '').split('\n');
		this.baseUrl = baseUrl;
		this.blueskyPosts = blueskyPosts ?? true;
		this.breaks = breaks ?? false;
	}

	// relative and #anchor links point at the canonical page; anything that
	// isn't a valid URL stays text
	href(value: string | null | undefined): string | null {
		try {
			return new URL(value as string, this.baseUrl).href;
		} catch {
			return null;
		}
	}

	inline(children: MarkdownToken[], rt: RichText) {
		for (const token of children) {
			const mark = MARK_TOKENS[token.type];
			if (mark) {
				rt[mark[1]](mark[0]);
				continue;
			}
			switch (token.type) {
				case 'text':
				case 'emoji':
					rt.push(token.content);
					break;
				// a soft break is only a line break when the site renders it as one
				case 'softbreak':
					rt.push(this.breaks ? '\n' : ' ');
					break;
				case 'hardbreak':
					rt.push('\n');
					break;
				case 'code_inline':
					rt.push(token.content, { code: true });
					break;
				// a link hidden from screen readers is decoration, like the "#"
				// permalink markdown-it-anchor adds to headings
				case 'link_open': {
					const hidden = token.attrGet('aria-hidden') === 'true' ? 1 : 0;
					rt.hidden += hidden;
					rt.links.push(this.href(attr(token, 'href')) || undefined);
					rt.hiddenLinks.push(hidden);
					break;
				}
				case 'link_close':
					rt.links.pop();
					rt.hidden -= rt.hiddenLinks.pop() ?? 0;
					break;
				// somewhere an image block can't go (a list item, a heading): link it
				case 'image':
					this.inlineImage(attr(token, 'src'), token.content, rt);
					break;
				case 'html_inline':
					if (BR.test(token.content)) {
						rt.push('\n');
					} else if (IMG.test(token.content)) {
						this.inlineImage(attribute(token.content, 'src'), attribute(token.content, 'alt'), rt);
					} else if (HIDDEN_OPEN.test(token.content)) {
						rt.hidden++;
					} else if (HIDDEN_CLOSE.test(token.content)) {
						rt.hidden = Math.max(0, rt.hidden - 1);
					}
					break;
			}
		}
	}

	inlineImage(src: string | null | undefined, alt: string | undefined, rt: RichText) {
		const href = src && this.href(src);
		rt.links.push(href || undefined);
		rt.push(alt || href || '');
		rt.links.pop();
	}

	// an image block, which needs its file uploaded before it's finished, with a
	// link to the image to fall back on
	image(src: string | null | undefined, alt: string | undefined): PendingBlock | null {
		const href = src && this.href(src);
		if (!href) return null;
		return {
			pending: 'image',
			src: src as string,
			url: href,
			alt,
			// alt text that's only whitespace would leave the link with no text
			fallback: this.linkBlock(alt?.trim() ? alt : href, href) as RichTextBlock
		};
	}

	textBlock(rt: RichText, type = TEXT): RichTextBlock | null {
		return rt.empty ? null : { $type: type, ...rt.build() };
	}

	// a paragraph is usually one text block, but images inside it become their
	// own blocks, and a bare bsky.app link on its own line becomes a post embed
	paragraph(inlineToken: MarkdownToken): Block[] {
		const children = inlineToken.children ?? [];
		if (
			this.blueskyPosts &&
			children.length === 3 &&
			children[0].type === 'link_open' &&
			children[1].type === 'text' &&
			children[2].type === 'link_close'
		) {
			const href = attr(children[0], 'href') ?? '';
			if (
				BSKY_POST_URL.test(href) &&
				children[1].content.replace(TRAILING_SLASH, '') === href.replace(TRAILING_SLASH, '')
			) {
				return [
					{ pending: 'bskyPost', url: href, fallback: this.linkBlock(href, href) as RichTextBlock }
				];
			}
		}

		const blocks: Array<Block | null> = [];
		let rt = new RichText();
		for (const token of children) {
			const image: [string | null | undefined, string | undefined] | null =
				token.type === 'image'
					? [attr(token, 'src'), token.content]
					: token.type === 'html_inline' && IMG.test(token.content)
						? [attribute(token.content, 'src'), attribute(token.content, 'alt')]
						: null;
			if (image && !rt.hidden) {
				blocks.push(this.textBlock(rt), this.image(...image));
				const { links, hiddenLinks, hidden } = rt;
				rt = new RichText();
				Object.assign(rt, { links, hiddenLinks, hidden });
			} else {
				this.inline([token], rt);
			}
		}
		blocks.push(this.textBlock(rt));
		return blocks.filter((block): block is Block => !!block);
	}

	linkBlock(text: string, href: string): RichTextBlock | null {
		const rt = new RichText();
		rt.links.push(this.href(href) || undefined);
		rt.push(text);
		return this.textBlock(rt);
	}

	// squash everything between two tokens into one rich text, for places a
	// leaflet block can only hold text (blockquotes, list items)
	flatten(tokens: MarkdownToken[], start: number, end: number, rt: RichText, separator = '\n\n') {
		for (let i = start; i < end; i++) {
			const token = tokens[i];
			if (token.type === 'inline') {
				rt.separate(separator);
				this.inline(token.children ?? [], rt);
			} else if (token.type === 'fence' || token.type === 'code_block') {
				rt.separate(separator);
				rt.push(token.content.replace(TRAILING_NEWLINE, ''), { code: true });
			} else if (token.type === 'list_item_open') {
				rt.separate('\n');
				rt.push(token.info ? `${token.info}. ` : '- ');
				const close = closing(tokens, i);
				const item = new RichText();
				this.flatten(tokens, i + 1, close, item, '\n');
				rt.runs.push(...item.runs);
				i = close;
			} else if (token.type === 'html_block') {
				for (const block of this.htmlBlocks(token.content)) {
					rt.separate(separator);
					if ('pending' in block) {
						this.inlineImage(block.src, block.alt, rt);
					} else {
						rt.push(block.plaintext, { code: block.$type === CODE });
					}
				}
			}
		}
		return rt;
	}

	// a chunk of HTML as blocks: its text as paragraphs, <pre> as code, and
	// <img> as images. what's in <script>, <style>, and the like is dropped.
	htmlBlocks(html: string): Array<RichTextBlock | PendingBlock> {
		const parts = html.replace(COMMENT, '').replace(HIDDEN_ELEMENT, '').split(PRE_OR_IMG);
		return parts
			.flatMap((part, index): Array<RichTextBlock | PendingBlock | null> => {
				if (index % 2 === 0) {
					return htmlParagraphs(part).map((plaintext) => ({ $type: TEXT, plaintext }));
				}
				if (IMG.test(part)) return [this.image(attribute(part, 'src'), attribute(part, 'alt'))];
				// a <pre>'s first newline is part of its tag, not its text
				const plaintext = decodeHTML(part.replace(TAG, ''))
					.replace(LEADING_NEWLINE, '')
					.replace(TRAILING_NEWLINE, '');
				return [plaintext ? { $type: CODE, plaintext } : null];
			})
			.filter((block): block is RichTextBlock | PendingBlock => !!block);
	}

	list(tokens: MarkdownToken[], start: number, end: number): ListBlock {
		const ordered = tokens[start].type === 'ordered_list_open';
		const type = ordered ? 'pub.leaflet.blocks.orderedList' : 'pub.leaflet.blocks.unorderedList';
		const children: ListItem[] = [];

		for (let i = start + 1; i < end; i++) {
			if (tokens[i].type !== 'list_item_open') continue;
			const itemEnd = closing(tokens, i);
			const rt = new RichText();
			const item = { $type: `${type}#listItem` } as ListItem;

			for (let j = i + 1; j < itemEnd; j++) {
				const token = tokens[j];
				if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
					const nestedEnd = closing(tokens, j);
					const nested = this.list(tokens, j, nestedEnd);
					if (nested.$type === type) {
						item.children = [...(item.children || []), ...nested.children];
					} else {
						const key = ordered ? 'unorderedListChildren' : 'orderedListChildren';
						const existing = item[key];
						item[key] = existing
							? { ...existing, children: [...existing.children, ...nested.children] }
							: nested;
					}
					j = nestedEnd;
				} else if (token.nesting === 1) {
					const blockEnd = closing(tokens, j);
					this.flatten(tokens, j, blockEnd, rt, '\n');
					j = blockEnd;
				} else {
					this.flatten(tokens, j, j + 1, rt, '\n');
				}
			}

			item.content = { $type: TEXT, ...rt.build() };
			children.push(item);
			i = itemEnd;
		}

		const block: ListBlock = { $type: type, children };
		const startIndex = Number(tokens[start].attrGet('start') || 1);
		if (ordered && startIndex !== 1) block.startIndex = startIndex;
		return block;
	}

	blocks(tokens: MarkdownToken[]): Block[] {
		const blocks: Block[] = [];
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			switch (token.type) {
				case 'heading_open': {
					const level = Math.min(6, Math.max(1, Number(token.tag.slice(1))));
					const rt = new RichText();
					this.inline(tokens[i + 1].children ?? [], rt);
					if (!rt.empty) blocks.push({ $type: 'pub.leaflet.blocks.header', level, ...rt.build() });
					i = closing(tokens, i);
					break;
				}
				case 'paragraph_open':
					blocks.push(...this.paragraph(tokens[i + 1]));
					i = closing(tokens, i);
					break;
				case 'fence':
				case 'code_block': {
					const language = (token.info || '').trim().split(SPACE_RUN)[0];
					blocks.push({
						$type: CODE,
						plaintext: token.content.replace(TRAILING_NEWLINE, ''),
						...(language && { language })
					});
					break;
				}
				case 'blockquote_open': {
					const close = closing(tokens, i);
					const block = this.textBlock(
						this.flatten(tokens, i + 1, close, new RichText()),
						'pub.leaflet.blocks.blockquote'
					);
					if (block) blocks.push(block);
					i = close;
					break;
				}
				case 'bullet_list_open':
				case 'ordered_list_open': {
					const close = closing(tokens, i);
					blocks.push(this.list(tokens, i, close));
					i = close;
					break;
				}
				case 'hr':
					blocks.push({ $type: 'pub.leaflet.blocks.horizontalRule' });
					break;
				case 'table_open': {
					// leaflet has no table block, and the markdown source keeps the
					// columns lined up in monospace
					const close = closing(tokens, i);
					const [from, to] = token.map ?? [0, 0];
					blocks.push({ $type: CODE, plaintext: this.lines.slice(from, to).join('\n').trim() });
					i = close;
					break;
				}
				case 'html_block':
					blocks.push(...this.htmlBlocks(token.content));
					break;
			}
		}
		return blocks;
	}
}

// a list block as indented plain text, nested lists and all
function listText(list: ListBlock, depth = 0): string {
	return list.children
		.map((item, index) => {
			const ordered = list.$type === 'pub.leaflet.blocks.orderedList';
			const bullet = ordered ? `${(list.startIndex || 1) + index}. ` : '- ';
			// nested items of the same kind have no startIndex of their own
			const nested = [
				item.children && { $type: list.$type, children: item.children },
				item.orderedListChildren,
				item.unorderedListChildren
			]
				.filter((child): child is ListBlock => !!child)
				.map((child) => listText(child, depth + 1));
			return ['  '.repeat(depth) + bullet + item.content.plaintext, ...nested].join('\n');
		})
		.join('\n');
}

/** The blocks as plain text, for the record's textContent (search and previews). */
export function plainText(blocks: readonly Block[]): string {
	return blocks
		.map((block) => {
			if ('pending' in block) return block.fallback.plaintext;
			if ('children' in block) return listText(block);
			return 'plaintext' in block ? block.plaintext : '';
		})
		.filter(Boolean)
		.join('\n\n');
}

export interface ConvertOptions {
	/** the Markdown the tokens were parsed from, which tables are copied out of */
	source?: string;
	/** the post's URL, which relative links resolve against */
	baseUrl?: string;
	/** turn a bare bsky.app post link on its own line into a post embed */
	blueskyPosts?: boolean;
	/** whether the site renders soft line breaks as line breaks */
	breaks?: boolean;
}

/**
 * Draft blocks from markdown-it tokens: finished leaflet blocks, plus pending
 * placeholders (images, Bluesky posts) that need the network to resolve into
 * blobs and strong refs. Each placeholder carries a text fallback.
 */
export function tokensToBlocks(
	tokens: MarkdownToken[],
	options: ConvertOptions = {}
): { blocks: Block[]; textContent: string } {
	const blocks = new Converter(options).blocks(tokens);
	return { blocks, textContent: plainText(blocks) };
}

/** The record's content: one linear page of finished blocks (pending ones resolved). */
export function toContent(blocks: readonly object[]) {
	return {
		$type: 'pub.leaflet.content',
		pages: [
			{
				$type: 'pub.leaflet.pages.linearDocument',
				blocks: blocks.map((block) => ({ $type: BLOCK, block }))
			}
		]
	};
}
