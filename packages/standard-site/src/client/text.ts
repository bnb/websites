// The limits at.upvote.comment puts on a comment's text.
export const MAX_BYTES = 50_000;
export const MAX_GRAPHEMES = 5_000;
/** the count shows from here on */
export const NEAR = 0.9;

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const encoder = new TextEncoder();

export interface Measure {
	graphemes: number;
	bytes: number;
}

/** How long `text` is, as the lexicon counts it: graphemes (what people see as characters) and UTF-8 bytes. */
export const measure = (text: string): Measure => ({
	graphemes: [...segmenter.segment(text)].length,
	bytes: encoder.encode(text).length
});

/** What's wrong with `text` as a comment, or null if nothing. */
export function problem(text: string): string | null {
	if (!text.trim()) return 'Write something first.';
	const { graphemes, bytes } = measure(text);
	if (graphemes > MAX_GRAPHEMES || bytes > MAX_BYTES)
		return "That's too long to post. Shorten it a little.";
	return null;
}

/** The count to show under the box, once it's near the limit; empty before that. */
export function counter(text: string): string {
	const { graphemes, bytes } = measure(text);
	const near = graphemes >= MAX_GRAPHEMES * NEAR || bytes >= MAX_BYTES * NEAR;
	return near ? `${graphemes.toLocaleString('en')} / ${MAX_GRAPHEMES.toLocaleString('en')}` : '';
}
