import type { MarkdownIt } from 'markdown-it';

// A blockquote whose first line is `[!PULL]`, the way GitHub marks its alerts,
// is a pull quote. The marker is taken out of the tokens, so the page, the
// feed and the leaflet record all get a plain blockquote (the page's with a
// class to style); Markdown that doesn't know it shows an ordinary blockquote.
const MARKER = /^\[!pull\]$/i;
const FIRST_LINE = /^[^\n]*\n?/;
const BREAKS = new Set(['softbreak', 'hardbreak']);

export function pullQuotes(md: MarkdownIt): void {
	md.core.ruler.after('inline', 'pull_quote', ({ tokens }) => {
		for (let i = 0; i < tokens.length; i++) {
			const inline = tokens[i + 2];
			const isPull =
				tokens[i].type === 'blockquote_open' &&
				tokens[i + 1]?.type === 'paragraph_open' &&
				inline.children?.[0]?.type === 'text' &&
				MARKER.test(inline.children[0].content.trim());
			if (!isPull) continue;

			tokens[i].attrJoin('class', 'pull');
			const rest = inline.children!.slice(BREAKS.has(inline.children![1]?.type) ? 2 : 1);
			if (rest.length) {
				inline.children = rest;
				inline.content = inline.content.replace(FIRST_LINE, '');
			} else {
				// the marker had its paragraph to itself
				tokens.splice(i + 1, 3);
			}
		}
	});
}
