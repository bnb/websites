import { describe, expect, it } from 'vitest';
import { absoluteUrl, htmlToAbsoluteUrls } from './absolute-urls';

describe('absoluteUrl', () => {
	const base = 'https://bnb.im/posts/is-mdm/';

	it('resolves relative URLs and fragments against the base', () => {
		expect(absoluteUrl('#install', base)).toBe('https://bnb.im/posts/is-mdm/#install');
		expect(absoluteUrl('/img/a.png', base)).toBe('https://bnb.im/img/a.png');
		expect(absoluteUrl('diagram.png', base)).toBe('https://bnb.im/posts/is-mdm/diagram.png');
		expect(absoluteUrl('../other/', base)).toBe('https://bnb.im/posts/other/');
		expect(absoluteUrl('//cdn.test/a.png', base)).toBe('https://cdn.test/a.png');
	});

	it('leaves absolute URLs alone', () => {
		expect(absoluteUrl('https://github.com/bnb', base)).toBe('https://github.com/bnb');
		expect(absoluteUrl('mailto:hello@bnb.im', base)).toBe('mailto:hello@bnb.im');
	});

	it("leaves a URL that won't parse as it is", () => {
		expect(absoluteUrl('http://[not-a-host', base)).toBe('http://[not-a-host');
		expect(absoluteUrl('/a', 'not a base')).toBe('/a');
	});
});

describe('htmlToAbsoluteUrls', () => {
	const base = 'https://bnb.im/posts/x/';

	it('makes links, images, srcsets and citations absolute', () => {
		expect(
			htmlToAbsoluteUrls(
				'<p><a href="#intro">Intro</a> <a href="https://other.test/">elsewhere</a></p>' +
					'<img src="../img/a.png" srcset="a.png 1x, /b.png 2x" alt="">' +
					'<blockquote cite="/q"><p>quote</p></blockquote>',
				base
			)
		).toBe(
			'<p><a href="https://bnb.im/posts/x/#intro">Intro</a> <a href="https://other.test/">elsewhere</a></p>' +
				'<img src="https://bnb.im/posts/img/a.png" srcset="https://bnb.im/posts/x/a.png 1x, https://bnb.im/b.png 2x" alt="" />' +
				'<blockquote cite="https://bnb.im/q"><p>quote</p></blockquote>'
		);
	});

	it('trims whitespace around a URL', () => {
		expect(htmlToAbsoluteUrls('<a href=" /about/ ">a</a>', base)).toBe(
			'<a href="https://bnb.im/about/">a</a>'
		);
	});

	it('writes void tags XHTML-style', () => {
		expect(htmlToAbsoluteUrls('<p>one<br>\ntwo</p><hr>', base)).toBe('<p>one<br />\ntwo</p><hr />');
	});

	it('leaves HTML without URLs alone', () => {
		const html = '<h2 id="a">A &amp; B</h2>\n<pre><code>x &lt; y</code></pre>\n';
		expect(htmlToAbsoluteUrls(html, base)).toBe(html);
	});
});

describe('htmlToAbsoluteUrls, as the old RSS plugin did it', () => {
	it('reads quotes in a URL unescaped, so they come out percent-encoded', () => {
		expect(
			htmlToAbsoluteUrls('<a href="#usage-of-&quot;type&quot;">#</a>', 'https://bnb.im/posts/a/')
		).toBe('<a href="https://bnb.im/posts/a/#usage-of-%22type%22">#</a>');
	});

	it('handles ping lists and single-quoted or bare attribute values', () => {
		expect(
			htmlToAbsoluteUrls("<a href=page ping='/a, /b' class=x>link</a>", 'https://bnb.im/posts/a/')
		).toBe(
			'<a href="https://bnb.im/posts/a/page" ping="https://bnb.im/a, https://bnb.im/b" class="x">link</a>'
		);
	});

	it('leaves a void tag that already closes itself alone, and other tags untouched', () => {
		expect(htmlToAbsoluteUrls('<hr/><span class="token">x</span>', 'https://bnb.im/')).toBe(
			'<hr /><span class="token">x</span>'
		);
	});
});
