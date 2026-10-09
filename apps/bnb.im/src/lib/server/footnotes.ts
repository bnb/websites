import markdownItFootnote from 'markdown-it-footnote';
import type { MarkdownIt, Token } from 'markdown-it';

// Footnotes (markdown-it-footnote), set as sidenotes on wide screens. The
// first reference to each note carries the note's plain text in
// data-sidenote, which app.css floats into the margin; there's no second copy
// of the note in the markup, so feeds, word counts and screen readers only
// meet the footnote list at the end, which is what phones show.

// which note a footnote token belongs to, and which reference to it
const meta = (token: Token) => ({
	id: Number(token.meta?.id),
	subId: Number(token.meta?.subId ?? 0)
});

// what a run of inline tokens says, without markup
const plainText = (children: readonly Token[]) =>
	children
		.map((token) => {
			if (token.type === 'softbreak' || token.type === 'hardbreak') return ' ';
			return ['text', 'code_inline', 'image'].includes(token.type) ? token.content : '';
		})
		.join('');

// the caption markdown-it-footnote gives a reference: [1], or [1:1] for a
// second reference to the same note
const caption = (token: Token) => {
	const { id, subId } = meta(token);
	return `[${id + 1}${subId ? `:${subId}` : ''}]`;
};

export function footnotes(md: MarkdownIt): void {
	md.use(markdownItFootnote);

	// after footnote_tail has gathered the notes at the end of the document
	md.core.ruler.after('footnote_tail', 'sidenotes', ({ tokens }) => {
		const notes = new Map<number, string>();
		let note: number | undefined;
		for (const token of tokens) {
			if (token.type === 'footnote_open') note = meta(token).id;
			else if (token.type === 'footnote_close') note = undefined;
			else if (note !== undefined && token.type === 'inline') {
				const text = plainText(token.children ?? []);
				notes.set(note, notes.has(note) ? `${notes.get(note)} ${text}` : text);
			}
		}
		for (const ref of tokens.flatMap((token) => token.children ?? [])) {
			if (ref.type !== 'footnote_ref' || meta(ref).subId) continue;
			ref.attrSet('data-sidenote', `${meta(ref).id + 1}. ${notes.get(meta(ref).id) ?? ''}`.trim());
		}
	});

	// the back links are a bare ↩, so they get a name that says where they go
	const anchor = md.renderer.rules.footnote_anchor!;
	md.renderer.rules.footnote_anchor = (tokens, idx, options, env, self) =>
		anchor(tokens, idx, options, env, self).replace(
			'class="footnote-backref"',
			`class="footnote-backref" aria-label="Back to reference ${caption(tokens[idx]).slice(1, -1)}"`
		);

	const ref = md.renderer.rules.footnote_ref!;
	md.renderer.rules.footnote_ref = (tokens, idx, options, env, self) => {
		const html = ref(tokens, idx, options, env, self);
		const note = tokens[idx].attrGet('data-sidenote');
		if (note === null) return html;
		return html.replace(
			'<sup class="footnote-ref"',
			`<sup class="footnote-ref" data-sidenote="${md.utils.escapeHtml(String(note))}"`
		);
	};
}

const AS_LIST: Record<string, string> = {
	footnote_block_open: 'ordered_list_open',
	footnote_block_close: 'ordered_list_close',
	footnote_open: 'list_item_open',
	footnote_close: 'list_item_close'
};

/**
 * Leaflet has no footnotes, so for the record each reference becomes its
 * caption ("[1]") and the notes an ordered list after a rule, the way the page
 * sets them. Rewrites tokens from md.parse in place.
 */
export function footnotesAsList(tokens: Token[]): Token[] {
	return tokens.flatMap((token) => {
		for (const child of token.children ?? []) {
			if (child.type !== 'footnote_ref') continue;
			child.content = caption(child);
			child.type = 'text';
		}
		const isNotes = token.type === 'footnote_block_open';
		token.type = AS_LIST[token.type] ?? token.type;
		if (!isNotes) return [token];
		const Rule = token.constructor as new (type: string, tag: string, nesting: number) => Token;
		return [new Rule('hr', 'hr', 0), token];
	});
}
