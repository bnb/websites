// What's wrong with a build's posts, found before anything is written: fields
// the site.standard.document lexicon would reject (errors), and URIs that
// might not survive the next build (warnings).
import { pinProblem } from './pin';

const segmenter = new Intl.Segmenter();
const graphemes = (text: string) => [...segmenter.segment(text)].length;

// the lexicon limits strings by graphemes, and by UTF-8 bytes at ten times that
const tooLong = (text: string, maxGraphemes: number) =>
	Buffer.byteLength(text, 'utf8') > maxGraphemes * 10 || graphemes(text) > maxGraphemes;

const isValidDate = (date: unknown) => date instanceof Date && !Number.isNaN(date.getTime());

function checkText(
	name: string,
	value: unknown,
	maxGraphemes: number,
	{ required = false } = {}
): string | null {
	if (value === undefined || value === null || value === '') {
		return required ? `has no ${name}, which a document needs` : null;
	}
	if (typeof value !== 'string')
		return `has a ${name} that isn't text (quote it in the front matter)`;
	if (tooLong(value, maxGraphemes)) return `has a ${name} over ${maxGraphemes} characters`;
	return null;
}

export interface CheckedDocument {
	inputPath: string;
	uri: string;
	pinned: boolean;
	title: unknown;
	description?: unknown;
	tags: unknown[];
	date: Date;
	updatedAt?: Date;
	/** whether the date comes from the post itself, not the file system */
	fixedDate: boolean;
}

export function checkDocuments(documents: readonly CheckedDocument[]) {
	const errors: string[] = [];
	const warnings: string[] = [];
	for (const doc of documents) {
		const problems = [
			checkText('title', doc.title, 500, { required: true }),
			checkText('description', doc.description, 3000),
			...doc.tags.map((tag) => checkText(`tag "${tag}"`, tag, 128)),
			isValidDate(doc.date) ? null : 'has an invalid date',
			doc.updatedAt === undefined || isValidDate(doc.updatedAt) ? null : 'has an invalid updatedAt'
		];
		for (const problem of problems.filter(Boolean)) errors.push(`${doc.inputPath} ${problem}`);

		if (!doc.pinned) {
			if (!doc.fixedDate) {
				warnings.push(
					`${doc.inputPath} has no date of its own, so its at:// URI can change between checkouts until it's pinned. Commit the atUri publishing adds to it, or give it a \`date\`.`
				);
			}
			const problem = pinProblem(doc);
			if (problem) {
				warnings.push(
					`${doc.inputPath} ${problem}, so its URI can't be pinned automatically. Add \`atUri: "${doc.uri}"\` to its data yourself.`
				);
			}
		}
	}
	return { errors, warnings };
}
