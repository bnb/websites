// Checks for the records publishing writes: validation against the published
// lexicons in ./lexicons (copied from the original implementation's test suite), plus
// the rules for rich text that the lexicons can't express.
import fs from 'node:fs';
import path from 'node:path';
import { jsonToLex, Lexicons, type LexiconDoc } from '@atproto/lexicon';

const dir = path.join(import.meta.dirname, 'lexicons');
const lexicons = new Lexicons(
	fs
		.readdirSync(dir)
		.map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as LexiconDoc)
);

const CODE_BLOCK = 'pub.leaflet.blocks.code';
const CODE_FACET = 'pub.leaflet.richtext.facet#code';

interface Text {
	$type?: string;
	plaintext: string;
	facets?: Array<{
		index: { byteStart: number; byteEnd: number };
		features: Array<{ $type: string }>;
	}>;
}

// every rich text (plaintext plus facets) in a value, with where it is
function* richTexts(value: unknown, where = 'record'): Generator<[string, Text]> {
	if (Array.isArray(value)) {
		for (const [index, item] of value.entries()) yield* richTexts(item, `${where}[${index}]`);
	} else if (value && typeof value === 'object') {
		if (typeof (value as Text).plaintext === 'string') yield [where, value as Text];
		for (const [key, item] of Object.entries(value)) yield* richTexts(item, `${where}.${key}`);
	}
}

/**
 * Facets index UTF-8 bytes: each must be a non-empty range inside the text,
 * start and end on character boundaries, and not overlap the one before.
 */
export function assertValidFacets({ plaintext, facets = [] }: Text, where = 'text') {
	const bytes = Buffer.from(plaintext, 'utf8');
	const boundary = (index: number) => index === bytes.length || (bytes[index] & 0xc0) !== 0x80;
	let previousEnd = 0;
	for (const { index, features } of facets) {
		const { byteStart, byteEnd } = index;
		const problem =
			(!(byteStart < byteEnd) && 'is empty') ||
			(byteEnd > bytes.length && 'runs past the text') ||
			(!(boundary(byteStart) && boundary(byteEnd)) && 'splits a character') ||
			(byteStart < previousEnd && 'overlaps the facet before it') ||
			(!features.length && 'has no features');
		if (problem) {
			throw new Error(
				`${where}: facet ${byteStart}–${byteEnd} ${problem} in ${JSON.stringify(plaintext)}`
			);
		}
		previousEnd = byteEnd;
	}
}

/** Throws unless `record` is a valid `collection` record whose rich text holds together. */
export function assertValidRecord(collection: string, record: unknown) {
	const value = jsonToLex(record) as { content?: { $type?: string } };
	lexicons.assertValidRecord(collection, value);
	// content is an open union, so the record's own schema doesn't look inside
	if (value.content?.$type === 'pub.leaflet.content') {
		const result = lexicons.validate('pub.leaflet.content', value.content);
		if (!result.success) throw new Error(`Invalid content: ${result.error.message}`);
	}
	for (const [where, text] of richTexts(record)) assertValidFacets(text, where);
}

// the text a reader sees as prose: rich text outside code blocks, minus any
// stretches marked as code
function prose(value: unknown): Array<[string, string]> {
	const found: Array<[string, string]> = [];
	for (const [where, text] of richTexts(value)) {
		if (text.$type === CODE_BLOCK) continue;
		const bytes = Buffer.from(text.plaintext, 'utf8');
		const code = (text.facets || []).filter((facet) =>
			facet.features.some((feature) => feature.$type === CODE_FACET)
		);
		let start = 0;
		let visible = '';
		for (const { index } of code) {
			visible += bytes.subarray(start, index.byteStart).toString('utf8');
			start = index.byteEnd;
		}
		visible += bytes.subarray(start).toString('utf8');
		found.push([where, visible]);
	}
	return found;
}

// markup that shouldn't survive conversion into a reader's prose: template
// tags (the source wasn't rendered), entities (HTML wasn't decoded), and tags
// (HTML wasn't stripped)
const RESIDUE: Array<[string, RegExp]> = [
	['template syntax', /\{[{%]|[%}]\}/],
	['an HTML entity', /&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/i],
	['an HTML tag', /<\/?[a-z][\w-]*(?:\s[^<>]*)?>/i]
];

export function assertNoMarkup(value: unknown) {
	for (const [where, text] of prose(value)) {
		for (const [what, pattern] of RESIDUE) {
			const match = pattern.exec(text);
			if (match) throw new Error(`${where} has ${what} (${match[0]}) in ${JSON.stringify(text)}`);
		}
	}
}
