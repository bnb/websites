import markdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import slugify from 'slugify';
import { footnotes } from './footnotes';
import { highlight } from './highlight';
import { pullQuotes } from './pull-quote';

// The Markdown setup the posts were written for, so every one renders the same:
// raw HTML allowed, soft breaks kept, bare URLs linked, Prism highlighting, and
// heading permalinks. Newer additions: footnotes (sidenotes on wide screens),
// `> [!PULL]` pull quotes, and a file name tab on fenced code.
export const MARKDOWN_OPTIONS = { html: true, breaks: true, linkify: true };

/** Heading ids: slugify, lowercased, with `-` between words. */
export function slug(text: string): string {
	return slugify(String(text), { replacement: '-', lower: true });
}

// markdown-it 14+ only links bare domains with a protocol by default; the posts
// were written against 13, which linked `example.com/path` and emails too.
const FUZZY = { fuzzyLink: true, fuzzyEmail: true };

export const md = markdownIt({ ...MARKDOWN_OPTIONS, highlight })
	.use(footnotes)
	.use(pullQuotes)
	.use(markdownItAnchor, {
		permalink: markdownItAnchor.permalink.ariaHidden({
			placement: 'after',
			class: 'direct-link',
			symbol: '#',
			// hidden from assistive tech, so kept out of the tab order too (axe's
			// aria-hidden-focus); the heading itself is the link target
			renderAttrs: () => ({ tabindex: '-1' })
		}),
		slugify: slug
	});
md.linkify.set(FUZZY);

// code blocks scroll sideways on small screens, so they take keyboard focus
// (axe's scrollable-region-focusable)
const PRE = /^<pre(?=[\s>])/;
const SPACE = /\s+/;
const TITLE = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/;
const fence = md.renderer.rules.fence!;

// A fence's info string names its language and, optionally, its file:
// ```js title="index.js". The language (as markdown-it reads it: the first
// word, without a /line-range) gets a sticker, the file a tab; the highlighted
// <pre> itself is unchanged.
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
	const pre = fence(tokens, idx, options, env, self).replace(PRE, '<pre tabindex="0"');
	const info = md.utils.unescapeAll(tokens[idx].info).trim();
	const [word] = info.split(SPACE, 1);
	const language = word.split('/')[0];
	const title = TITLE.exec(info.slice(word.length));
	const file = title && (title[1] ?? title[2] ?? title[3]);
	if (!language && !file) return pre;
	const { escapeHtml } = md.utils;
	const tab = file ? `<span class="code-file">${escapeHtml(file)}</span>` : '';
	const sticker = language ? `<span class="code-lang">${escapeHtml(language)}</span>` : '';
	return `<figure class="code">\n<figcaption>${tab}${sticker}</figcaption>\n${pre}</figure>\n`;
};
const codeBlock = md.renderer.rules.code_block!;
md.renderer.rules.code_block = (...args) => codeBlock(...args).replace(PRE, '<pre tabindex="0"');

const inline = markdownIt(MARKDOWN_OPTIONS);
inline.linkify.set(FUZZY);

/** Inline Markdown in a title (`code`, emphasis) as HTML. */
export function renderInline(text: string): string {
	return inline.renderInline(text);
}
