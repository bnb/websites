/** Zero-pad post numbers on the index: 7 → "07". */
export function pad2(n: number | string): string {
	return String(n).padStart(2, '0');
}

const TAG = /<[^>]*>/g;
const SPACE = /\s+/;

/** Words in rendered post HTML, not counting tags or attributes. */
export function wordCount(html: string): number {
	return html.replace(TAG, ' ').split(SPACE).filter(Boolean).length;
}

/** Rough minutes to read rendered post HTML, at ~230 words per minute. */
export function readingTime(html: string): number {
	return Math.max(1, Math.round(wordCount(html) / 230));
}

const TRAILING_COMMA = /,$/;

/** A post's tags minus the `post` collection tag (some front matter has stray commas). */
export function displayTags(tags: readonly string[] = []): string[] {
	return tags
		.map((tag) => tag.replace(TRAILING_COMMA, '').trim())
		.filter((tag) => tag && tag !== 'post');
}
