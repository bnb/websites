import { describe, expect, it } from 'vitest';
import { highlight, normalizeLanguage } from './highlight';

const wrapped = (language: string) =>
	new RegExp(
		`^<pre class="language-${language}"><code class="language-${language}">[\\s\\S]*</code></pre>$`
	);

describe('highlight', () => {
	it.each([
		['js', 'const a = 1;\n', '<span class="token keyword">const</span>'],
		['yaml', 'on: push\n', '<span class="token key atrule">on</span>'],
		['json', '{"a": 1}\n', '<span class="token property">"a"</span>'],
		['bash', 'echo hi\n', '<span class="token builtin class-name">echo</span>']
	])('highlights %s with Prism tokens', (language, code, token) => {
		const html = highlight(code, language);
		expect(html).toMatch(wrapped(language));
		expect(html).toContain(token);
	});

	it('drops the trailing newline markdown-it leaves on a fence', () => {
		expect(highlight('a\nb\n', 'text')).toBe(
			'<pre class="language-text"><code class="language-text">a\nb</code></pre>'
		);
		expect(highlight('a\nb', 'text')).toBe(
			'<pre class="language-text"><code class="language-text">a\nb</code></pre>'
		);
	});

	it('resolves aliases for the grammar but keeps the class as written', () => {
		const html = highlight('let a: number;\n', 'ts');
		expect(html).toMatch(wrapped('ts'));
		expect(html).toContain('<span class="token builtin">number</span>');
	});

	it('ignores line highlight ranges after a slash', () => {
		const html = highlight('const a = 1;\n', 'js/1-2');
		expect(html).toMatch(wrapped('js'));
		expect(html).toContain('<span class="token keyword">const</span>');
	});

	it('highlights a diff', () => {
		const html = highlight('- old\n+ new\n', 'diff');
		expect(html).toMatch(wrapped('diff'));
		expect(html).toContain('<span class="token deleted-sign deleted">');
		expect(html).toContain('<span class="token inserted-sign inserted">');
	});

	it('highlights a diff of a language, colouring the code inside it', () => {
		const html = highlight('- const a = 1;\n+ const b = 2;\n', 'diff-js');
		expect(html).toMatch(wrapped('diff-js'));
		expect(html).toContain('<span class="token deleted-sign deleted language-js">');
		expect(html).toContain('<span class="token inserted-sign inserted language-js">');
		expect(html).toContain('<span class="token keyword">const</span>');
	});

	it('passes text through as is', () => {
		expect(highlight('<b>x</b>\n', 'text')).toBe(
			'<pre class="language-text"><code class="language-text"><b>x</b></code></pre>'
		);
	});

	it("passes a language Prism doesn't know through unhighlighted", () => {
		expect(highlight('some <code>\n', 'not-a-language')).toBe(
			'<pre class="language-not-a-language"><code class="language-not-a-language">some <code></code></pre>'
		);
	});

	it('defers to markdown-it with no language', () => {
		expect(highlight('plain\n', '')).toBe('');
	});
});

describe('normalizeLanguage', () => {
	it('resolves Prism aliases', () => {
		expect(normalizeLanguage('ts')).toBe('typescript');
		expect(normalizeLanguage('sh')).toBe('bash');
		expect(normalizeLanguage('js')).toBe('javascript');
		expect(normalizeLanguage('yml')).toBe('yaml');
	});

	it('resolves an alias Prism lists under another language', () => {
		expect(normalizeLanguage('jinja2')).toBe('django');
	});

	it('keeps a language Prism knows by name', () => {
		expect(normalizeLanguage('javascript')).toBe('javascript');
		expect(normalizeLanguage('json')).toBe('json');
	});

	it('leaves an unknown language alone', () => {
		expect(normalizeLanguage('not-a-language')).toBe('not-a-language');
	});
});
