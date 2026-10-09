import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pinAtUri, pinProblem } from './pin';
import { useTmpDir } from './test/tmp';

const URI = 'at://did:plc:author/site.standard.document/3lpin2222222';
const tmp = useTmpDir();

// writes `source` to a post file, pins URI into it, and reads it back
function pin(source: string, name = 'post.md') {
	const inputPath = path.join(tmp.path, name);
	fs.writeFileSync(inputPath, source);
	pinAtUri({ inputPath, uri: URI });
	return fs.readFileSync(inputPath, 'utf8');
}

describe('pinAtUri', () => {
	it.each([
		['no front matter', 'no front matter\n', `---\natUri: "${URI}"\n---\nno front matter\n`],
		['an empty file', '', `---\natUri: "${URI}"\n---\n`],
		['empty front matter', '---\n---\nempty\n', `---\natUri: "${URI}"\n---\nempty\n`],
		[
			'YAML front matter',
			'---\ntitle: Hello\ndate: 2026-01-01\n---\nBody\n',
			`---\ntitle: Hello\ndate: 2026-01-01\natUri: "${URI}"\n---\nBody\n`
		],
		[
			'front matter named as YAML',
			'---yaml\ntitle: x\n---\n',
			`---yaml\ntitle: x\natUri: "${URI}"\n---\n`
		],
		[
			'front matter named as YML',
			'--- YML \ntitle: x\n---\n',
			`--- YML \ntitle: x\natUri: "${URI}"\n---\n`
		],
		[
			'CRLF line endings',
			'---yaml\r\ntitle: crlf\r\n---\r\nbody\r\n',
			`---yaml\r\ntitle: crlf\r\natUri: "${URI}"\r\n---\r\nbody\r\n`
		],
		[
			'CRLF and no front matter',
			'body\r\nmore\r\n',
			`---\r\natUri: "${URI}"\r\n---\r\nbody\r\nmore\r\n`
		],
		[
			'a BOM and no front matter',
			'﻿bom, no front matter\n',
			`﻿---\natUri: "${URI}"\n---\nbom, no front matter\n`
		],
		['a BOM and front matter', '﻿---\ntitle: x\n---\n', `﻿---\ntitle: x\natUri: "${URI}"\n---\n`],
		// a placeholder is filled in, since YAML doesn't allow the key twice
		['an empty atUri', '---\natUri: ""\ntitle: x\n---\n', `---\natUri: "${URI}"\ntitle: x\n---\n`],
		['a bare atUri', '---\natUri:\n---\n', `---\natUri: "${URI}"\n---\n`],
		['a spaced atUri', '---\natUri  : ~\n---\n', `---\natUri: "${URI}"\n---\n`],
		// a later --- in the body isn't the front matter's end
		[
			'a rule in the body',
			'---\ntitle: x\n---\nabove\n\n---\n\nbelow\n',
			`---\ntitle: x\natUri: "${URI}"\n---\nabove\n\n---\n\nbelow\n`
		]
	])('writes into a post with %s', (_, before, after) => {
		expect(pin(before)).toBe(after);
	});

	it('leaves an atUri that only appears in the body alone', () => {
		expect(pin('---\ntitle: x\n---\natUri: in the body\n')).toBe(
			`---\ntitle: x\natUri: "${URI}"\n---\natUri: in the body\n`
		);
	});

	it("won't write into front matter that isn't YAML", () => {
		const file = path.join(tmp.path, 'post.md');
		expect(() => pin('---\ntitle: x\n')).toThrow(`${file} has front matter with no closing ---`);
		expect(() => pin('---json\n{ "title": "x" }\n---\n')).toThrow(
			`${file} has json front matter, which only YAML is written to`
		);
		expect(() => pin('---toml\ntitle = "x"\n---\n')).toThrow(
			`${file} has toml front matter, which only YAML is written to`
		);
	});

	it("won't write into a JavaScript template, or a file it can't read", () => {
		for (const name of [
			'post.11ty.js',
			'post.mjs',
			'post.cjs',
			'post.ts',
			'post.mts',
			'post.jsx',
			'post.tsx'
		]) {
			expect(() => pinAtUri({ inputPath: path.join(tmp.path, name), uri: URI })).toThrow(
				`${path.join(tmp.path, name)} is a JavaScript template, which has no front matter`
			);
		}
		const gone = path.join(tmp.path, 'gone.md');
		expect(() => pinAtUri({ inputPath: gone, uri: URI })).toThrow(`${gone} can't be read (ENOENT)`);
	});
});

describe('pinProblem', () => {
	it('is null for posts that can be pinned', () => {
		for (const source of ['', 'body', '---\n---\n', '---yaml\nx: 1\n---\n', '---yml\n---\n']) {
			const inputPath = path.join(tmp.path, 'post.md');
			fs.writeFileSync(inputPath, source);
			expect(pinProblem({ inputPath })).toBeNull();
		}
	});

	it('says why a post can’t be pinned', () => {
		const inputPath = path.join(tmp.path, 'post.md');
		fs.writeFileSync(inputPath, '---json\n{}\n---\n');
		expect(pinProblem({ inputPath })).toBe('has json front matter, which only YAML is written to');
		fs.writeFileSync(inputPath, '---\ntitle: x');
		expect(pinProblem({ inputPath })).toBe('has front matter with no closing ---');
		expect(pinProblem({ inputPath: path.join(tmp.path, 'post.11ty.js') })).toBe(
			'is a JavaScript template, which has no front matter'
		);
		expect(pinProblem({ inputPath: tmp.path })).toBe("can't be read (EISDIR)");
	});
});
