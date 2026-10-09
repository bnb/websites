import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appScriptHash, contentSecurityPolicy } from './csp.js';

function template(html: string): string {
	const file = join(mkdtempSync(join(tmpdir(), 'csp-')), 'app.html');
	writeFileSync(file, html);
	return file;
}

describe('appScriptHash', () => {
	it('hashes the inline script exactly as the browser will', () => {
		const script = "\n\tdocument.documentElement.classList.add('js');\n";
		const expected = createHash('sha256').update(script).digest('base64');
		expect(appScriptHash(template(`<head><script>${script}</script></head>`))).toBe(
			`sha256-${expected}`
		);
	});

	it('is null for a template without an inline script', () => {
		expect(appScriptHash(template('<head></head>'))).toBeNull();
	});
});

describe('contentSecurityPolicy', () => {
	it('starts from self, in hash mode, with framing denied', () => {
		const csp = contentSecurityPolicy();
		expect(csp?.mode).toBe('hash');
		expect(csp?.directives).toMatchObject({
			'default-src': ['self'],
			'script-src': ['self'],
			'img-src': ['self', 'data:'],
			'object-src': ['none'],
			'frame-ancestors': ['none']
		});
		expect(csp?.directives?.['media-src']).toBeUndefined();
	});

	it('adds what a site needs', () => {
		const csp = contentSecurityPolicy({
			scripts: ['sha256-abc'],
			images: ['https:'],
			media: ['https://audio.example'],
			connect: ['https:'],
			frameAncestors: false
		});
		expect(csp?.directives).toMatchObject({
			'script-src': ['self', 'sha256-abc'],
			'img-src': ['self', 'data:', 'https:'],
			'media-src': ['self', 'https://audio.example'],
			'connect-src': ['self', 'https:']
		});
		expect(csp?.directives?.['frame-ancestors']).toBeUndefined();
	});
});
