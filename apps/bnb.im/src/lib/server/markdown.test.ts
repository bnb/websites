import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARKDOWN_OPTIONS, md, renderInline, slug } from './markdown';

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const CODE_TAB =
	/^<figure class="code">\n<figcaption><span class="code-file">index\.js<\/span><span class="code-lang">js<\/span><\/figcaption>\n<pre tabindex="0" class="language-js">/;

// no post uses the newer syntax yet, so a fixture shows it all
const FEATURES = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/features.md'), 'utf8');

const text = (html: string) => html.replaceAll(/<[^>]*>/g, '');

describe('slug', () => {
	it('slugs with slugify, parentheses and all', () => {
		expect(slug('Diffing Individual Local File(s) with the Latest Remote Version')).toBe(
			'diffing-individual-local-file(s)-with-the-latest-remote-version'
		);
	});

	it('lowercases, joins words with hyphens and drops what slugify drops', () => {
		expect(slug('Hello World')).toBe('hello-world');
		expect(slug('What is `npm diff`?')).toBe('what-is-npm-diff');
		expect(slug('Node.js v12')).toBe('node.js-v12');
	});
});

describe('md (post Markdown)', () => {
	it('keeps the options the posts were written for', () => {
		expect(MARKDOWN_OPTIONS).toEqual({ html: true, breaks: true, linkify: true });
	});

	it('gives headings an id, a tabindex and a permalink after the text', () => {
		expect(md.render('## Getting Started')).toBe(
			'<h2 id="getting-started" tabindex="-1">Getting Started ' +
				'<a class="direct-link" href="#getting-started" aria-hidden="true" tabindex="-1">#</a></h2>\n'
		);
	});

	it('suffixes repeated headings so ids stay unique', () => {
		const html = md.render('## Setup\n\ntext\n\n## Setup\n\n### Setup\n');
		expect(html).toContain('<h2 id="setup" tabindex="-1">');
		expect(html).toContain('<h2 id="setup-1" tabindex="-1">');
		expect(html).toContain('<h3 id="setup-2" tabindex="-1">');
		expect(html).toContain('href="#setup-2"');
	});

	it('slugs heading ids the way they have always been', () => {
		const html = md.render('### Diffing Individual Local File(s) with the Latest Remote Version');
		expect(html).toContain('id="diffing-individual-local-file(s)-with-the-latest-remote-version"');
	});

	it('links bare domains with a path, bare domains, and emails', () => {
		const html = md.render('Use gihub.com/actions/checkout, see atproto.at or mail hello@bnb.im');
		expect(html).toContain(
			'<a href="http://gihub.com/actions/checkout">gihub.com/actions/checkout</a>'
		);
		expect(html).toContain('<a href="http://atproto.at">atproto.at</a>');
		expect(html).toContain('<a href="mailto:hello@bnb.im">hello@bnb.im</a>');
	});

	it('links full URLs', () => {
		expect(md.render('https://bsky.app/profile/bnb.im/post/3mwvwapoefs26')).toBe(
			'<p><a href="https://bsky.app/profile/bnb.im/post/3mwvwapoefs26">https://bsky.app/profile/bnb.im/post/3mwvwapoefs26</a></p>\n'
		);
	});

	it('renders GitHub Actions expressions literally', () => {
		expect(md.render('Runs on ${{ matrix.os }} each time.')).toBe(
			'<p>Runs on ${{ matrix.os }} each time.</p>\n'
		);
		const block = md.render('```yaml\nruns-on: ${{ matrix.os }}\n```\n');
		expect(block).toContain('class="language-yaml"');
		expect(text(block)).toContain('runs-on: ${{ matrix.os }}');
	});

	it('keeps soft line breaks', () => {
		expect(md.render('one\ntwo')).toBe('<p>one<br>\ntwo</p>\n');
	});

	it('passes raw HTML through', () => {
		expect(md.render('<aside class="note">hi</aside>')).toBe('<aside class="note">hi</aside>');
	});

	it('highlights fenced code with Prism', () => {
		const html = md.render('```js\nconst a = 1;\n```\n');
		expect(html).toContain('<code class="language-js"><span class="token keyword">const</span>');
	});

	it("escapes an unlabelled fence itself, as markdown-it does when highlight returns ''", () => {
		expect(md.render('```\n<b>bold</b>\n```\n')).toContain('&lt;b&gt;bold&lt;/b&gt;');
	});
});

describe('pull quotes', () => {
	it('makes a `> [!PULL]` blockquote a pull quote, without the marker', () => {
		expect(md.render('> [!PULL]\n> Garbage, but *selected*.')).toBe(
			'<blockquote class="pull">\n<p>Garbage, but <em>selected</em>.</p>\n</blockquote>\n'
		);
	});

	it('takes the marker in any case, alone in its paragraph or not', () => {
		expect(md.render('> [!pull]\n>\n> One.\n>\n> Two.')).toBe(
			'<blockquote class="pull">\n<p>One.</p>\n<p>Two.</p>\n</blockquote>\n'
		);
	});

	it('leaves other blockquotes, and the marker mid-quote, alone', () => {
		expect(md.render('> Just a quote.')).toBe(
			'<blockquote>\n<p>Just a quote.</p>\n</blockquote>\n'
		);
		expect(md.render('> Quote\n> [!PULL]')).toBe(
			'<blockquote>\n<p>Quote<br>\n[!PULL]</p>\n</blockquote>\n'
		);
	});
});

describe('code block tabs', () => {
	it('gives a fence a file tab and a language sticker from its info string', () => {
		const html = md.render('```js title="index.js"\nconst a = 1;\n```\n');
		expect(html).toMatch(CODE_TAB);
		expect(html.endsWith('</pre>\n</figure>\n')).toBe(true);
	});

	it('leaves the highlighted <pre> exactly as it was', () => {
		const plain = md.render('```js\nconst a = 1;\n```\n');
		const titled = md.render("```js title='a b.js'\nconst a = 1;\n```\n");
		const pre = (html: string) => html.slice(html.indexOf('<pre'), html.indexOf('</pre>'));
		expect(pre(titled)).toBe(pre(plain));
		expect(titled).toContain('<span class="code-file">a b.js</span>');
		expect(md.render('```js title=main.js\n1\n```\n')).toContain(
			'<span class="code-file">main.js</span>'
		);
	});

	it('shows the language without a file name, minus any line range', () => {
		expect(md.render('```diff-js/1-2\n+a\n```\n')).toContain(
			'<figcaption><span class="code-lang">diff-js</span></figcaption>'
		);
	});

	it('escapes the file name', () => {
		expect(md.render('```html title="<x>.html"\n<p></p>\n```\n')).toContain(
			'<span class="code-file">&lt;x&gt;.html</span>'
		);
	});

	it('leaves unlabelled fences and indented code unwrapped', () => {
		expect(md.render('```\nplain\n```\n')).toBe('<pre tabindex="0"><code>plain\n</code></pre>\n');
		expect(md.render('    indented\n')).not.toContain('<figure');
	});
});

describe('footnotes', () => {
	const html = md.render(FEATURES);

	it('links each reference to its note in the list at the end', () => {
		expect(html).toContain('<a href="#fn1" id="fnref1">[1]</a></sup>');
		expect(html).toContain('<a href="#fn1" id="fnref1:1">[1:1]</a></sup>');
		expect(html).toContain('<li id="fn1" class="footnote-item"><p>Because a');
		expect(html).toContain('<li id="fn2" class="footnote-item"><p>Short and <code>sweet</code>.');
		expect(html).toContain(
			'<a href="#fnref1" class="footnote-backref" aria-label="Back to reference 1">'
		);
		expect(html).toContain('aria-label="Back to reference 1:1"');
	});

	it("carries each note's text on its first reference, for the sidenote", () => {
		expect(html).toContain(
			'<sup class="footnote-ref" data-sidenote="1. Because a link fits better down here.">'
		);
		expect(html).toContain('<sup class="footnote-ref" data-sidenote="2. Short and sweet.">');
		// a second reference doesn't repeat the note beside it
		expect(html).toContain('<sup class="footnote-ref"><a href="#fn1" id="fnref1:1">');
	});

	it('joins a note of several paragraphs into one sidenote', () => {
		expect(md.render('Hi.[^a]\n\n[^a]: One.\n\n    Two.\n')).toContain(
			'data-sidenote="1. One. Two."'
		);
	});

	it('escapes the sidenote text', () => {
		expect(md.render('Hi.^[a "quoted" <b>note</b>]')).toContain(
			'data-sidenote="1. a &quot;quoted&quot; note"'
		);
	});
});

describe('renderInline', () => {
	it('renders inline Markdown in titles without a paragraph', () => {
		expect(renderInline('Jest and the `--changedSince` flag in GitHub Actions CI')).toBe(
			'Jest and the <code>--changedSince</code> flag in GitHub Actions CI'
		);
		expect(renderInline('An *emphatic* title')).toBe('An <em>emphatic</em> title');
	});

	it('escapes HTML-significant characters in plain text', () => {
		expect(renderInline('Implicit ESM in Node.js with "type": "module" & <friends>')).toBe(
			'Implicit ESM in Node.js with &quot;type&quot;: &quot;module&quot; &amp; <friends>'
		);
	});

	it('has no heading anchors', () => {
		expect(renderInline('## Not a heading')).toBe('## Not a heading');
	});
});
