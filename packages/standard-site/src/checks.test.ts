import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDocuments, type CheckedDocument } from './checks';
import { useTmpDir } from './test/tmp';

const tmp = useTmpDir();
const URI = 'at://did:plc:author/site.standard.document/3ldoc2222222';

function doc(slug: string, fields: Partial<CheckedDocument> = {}, source = '---\ntitle: x\n---\n') {
	const inputPath = path.join(tmp.path, `${slug}.md`);
	fs.writeFileSync(inputPath, source);
	return {
		inputPath,
		uri: URI,
		pinned: true,
		title: slug,
		tags: [],
		date: new Date('2026-01-01T00:00:00Z'),
		fixedDate: true,
		...fields
	} satisfies CheckedDocument;
}

// problems without the temporary directory in front
const relative = (problems: string[]) =>
	problems.map((problem) => problem.replace(`${tmp.path}${path.sep}`, ''));

describe('checkDocuments', () => {
	it('finds nothing wrong with a well-formed post', () => {
		expect(
			checkDocuments([
				doc('fine', {
					description: 'About it',
					tags: ['notes'],
					updatedAt: new Date('2026-02-01T00:00:00Z')
				})
			])
		).toEqual({ errors: [], warnings: [] });
	});

	it('finds fields the lexicon would reject', () => {
		const family = '👩‍👩‍👧'.repeat(129);
		const { errors } = checkDocuments([
			doc('untitled', { title: undefined }),
			doc('blank', { title: '' }),
			doc('numbered', { title: 1984 }),
			doc('long', { title: 'é'.repeat(501) }),
			doc('described', { description: 'x'.repeat(3001) }),
			doc('quoted', { description: 42 }),
			doc('tagged', { tags: ['ok', family] }),
			doc('updated', { updatedAt: new Date('yesterday') }),
			doc('dated', { date: new Date('someday') })
		]);
		expect(relative(errors)).toEqual([
			'untitled.md has no title, which a document needs',
			'blank.md has no title, which a document needs',
			"numbered.md has a title that isn't text (quote it in the front matter)",
			'long.md has a title over 500 characters',
			'described.md has a description over 3000 characters',
			"quoted.md has a description that isn't text (quote it in the front matter)",
			`tagged.md has a tag "${family}" over 128 characters`,
			'updated.md has an invalid updatedAt',
			'dated.md has an invalid date'
		]);
	});

	it('counts graphemes, and bytes at ten per grapheme', () => {
		// 500 families are 500 graphemes, but 9000 bytes
		const { errors } = checkDocuments([
			doc('graphemes', { title: '👩‍👩‍👧'.repeat(250) }),
			doc('bytes', { title: '👩‍👩‍👧'.repeat(300) }),
			doc('exact', { title: 'x'.repeat(500), tags: ['t'.repeat(128)] })
		]);
		expect(relative(errors)).toEqual(['bytes.md has a title over 500 characters']);
	});

	it('takes a description, tags, and updatedAt as optional', () => {
		expect(
			checkDocuments([doc('bare', { description: null, updatedAt: undefined })]).errors
		).toEqual([]);
	});

	it('warns about an unpinned post whose date comes from the file system', () => {
		const { errors, warnings } = checkDocuments([
			doc('undated', { pinned: false, fixedDate: false }),
			doc('dated', { pinned: false }),
			doc('pinned', { fixedDate: false })
		]);
		expect(errors).toEqual([]);
		expect(relative(warnings)).toEqual([
			"undated.md has no date of its own, so its at:// URI can change between checkouts until it's pinned. Commit the atUri publishing adds to it, or give it a `date`."
		]);
	});

	it('warns about an unpinned post its URI can’t be written into', () => {
		const { warnings } = checkDocuments([
			doc('json', { pinned: false }, '---json\n{}\n---\n'),
			doc('unclosed', { pinned: false }, '---\ntitle: x\n'),
			{ ...doc('template', { pinned: false }), inputPath: path.join(tmp.path, 'template.11ty.js') },
			// a pinned post is never written to
			doc('pinned', {}, '---json\n{}\n---\n')
		]);
		expect(relative(warnings)).toEqual([
			`json.md has json front matter, which only YAML is written to, so its URI can't be pinned automatically. Add \`atUri: "${URI}"\` to its data yourself.`,
			`unclosed.md has front matter with no closing ---, so its URI can't be pinned automatically. Add \`atUri: "${URI}"\` to its data yourself.`,
			`template.11ty.js is a JavaScript template, which has no front matter, so its URI can't be pinned automatically. Add \`atUri: "${URI}"\` to its data yourself.`
		]);
	});
});
