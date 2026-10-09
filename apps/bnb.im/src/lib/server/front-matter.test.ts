import { describe, expect, it } from 'vitest';
import { frontMatter } from './front-matter';

describe('frontMatter', () => {
	it('reads YAML front matter and the body after it', () => {
		const { data, content } = frontMatter(
			'---\ntitle: "Conditional Exports: Supporting both import and require()"\ndate: 2021-06-17\ntags:\n  - post\n  - webdev,\npart: "3"\n---\n\nThe body.\n'
		);
		expect(data).toEqual({
			title: 'Conditional Exports: Supporting both import and require()',
			// dates stay strings; posts.ts reads them as midnight UTC
			date: '2021-06-17',
			tags: ['post', 'webdev,'],
			part: '3'
		});
		expect(content).toBe('\nThe body.\n');
	});

	it('handles a byte order mark, CRLF line endings and trailing spaces on the fences', () => {
		const { data, content } = frontMatter('﻿--- \r\ntitle: Hi\r\n---\t\r\nBody');
		expect(data).toEqual({ title: 'Hi' });
		expect(content).toBe('Body');
	});

	it('treats a file without front matter as all body', () => {
		expect(frontMatter('Just text.\n---\n')).toEqual({ data: {}, content: 'Just text.\n---\n' });
	});

	it('reads empty front matter as no data', () => {
		expect(frontMatter('---\n---\nBody')).toEqual({ data: {}, content: 'Body' });
	});

	it('refuses front matter that never closes, or that isn’t a mapping', () => {
		expect(() => frontMatter('---\ntitle: Hi\n')).toThrow('no closing ---');
		expect(() => frontMatter('---\n- a\n- b\n---\n')).toThrow('YAML mapping');
	});
});
