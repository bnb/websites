// sample posts, converted and checked: valid against the lexicons, with no
// markup left in the prose a reader sees, and nothing from the places a
// reader doesn't see (scripts, styles, comments), which the samples mark
// with the word LEAKED
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { toContent } from './leaflet';
import { convert } from './test/markdown';
import { assertNoMarkup, assertValidRecord } from './test/records';

const dir = path.join(import.meta.dirname, 'test', 'corpus');

describe.each(fs.readdirSync(dir))('%s', (file) => {
	it.each([false, true])('converts cleanly (breaks: %s)', (breaks) => {
		const { blocks, textContent } = convert(fs.readFileSync(path.join(dir, file), 'utf8'), {
			baseUrl: 'https://example.com/posts/sample/',
			breaks
		});
		expect(blocks.length).toBeGreaterThan(0);
		const content = toContent(blocks.map((block) => ('pending' in block ? block.fallback : block)));
		assertValidRecord('site.standard.document', {
			$type: 'site.standard.document',
			site: 'at://did:plc:corpus/site.standard.publication/3lpub2222222',
			title: file,
			publishedAt: '2026-01-01T00:00:00.000Z',
			textContent,
			content
		});
		assertNoMarkup(content);
		expect(JSON.stringify(content)).not.toContain('LEAKED');
		expect(textContent).not.toContain('LEAKED');
	});
});
