import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { describe, expect, it } from 'vitest';
import { plainText, toContent, tokensToBlocks, type Block } from './leaflet';
import {
	BASE_URL,
	convert,
	facet,
	itemText,
	link,
	list,
	pending,
	text,
	texts
} from './test/markdown';
import { assertNoMarkup, assertValidFacets } from './test/records';

const TEXT = 'pub.leaflet.blocks.text';
const CODE = 'pub.leaflet.blocks.code';

describe('paragraphs', () => {
	it('turns inline formatting into facets indexed by UTF-8 bytes', () => {
		const [block] = convert('💖 **bold** _it_ `code` ~~gone~~').blocks;
		// the emoji is 4 bytes, so everything after it is offset by 5
		expect(block).toEqual({
			$type: TEXT,
			plaintext: '💖 bold it code gone',
			facets: [
				facet(5, 9, 'bold'),
				facet(10, 12, 'italic'),
				facet(13, 17, 'code'),
				facet(18, 22, 'strikethrough')
			]
		});
	});

	it('counts accented and combining characters by their bytes', () => {
		// é is 2 bytes precomposed; e + U+0301 is 3
		const [block] = convert('café **é** e\u0301 *x*').blocks;
		expect(text(block).plaintext).toBe('café é e\u0301 x');
		expect(text(block).facets).toEqual([facet(6, 8, 'bold'), facet(13, 14, 'italic')]);
		assertValidFacets(text(block));
	});

	it('splits overlapping marks into facets that sit side by side', () => {
		const [block] = convert('**bold [link](https://a.example) more**').blocks;
		expect(block).toEqual({
			$type: TEXT,
			plaintext: 'bold link more',
			facets: [
				facet(0, 5, 'bold'),
				facet(5, 9, link('https://a.example/'), 'bold'),
				facet(9, 14, 'bold')
			]
		});
	});

	it('stacks every mark a run carries onto one facet', () => {
		const [block] = convert('***both*** and ~~**struck bold**~~').blocks;
		expect(text(block).facets).toEqual([
			facet(0, 4, 'bold', 'italic'),
			facet(9, 20, 'bold', 'strikethrough')
		]);
	});

	it('resolves relative and anchor links against the page', () => {
		const [block] = convert('[about](/about/) and [down](#later) and [up](../)').blocks;
		expect(text(block).facets?.map((f) => f.features[0].uri)).toEqual([
			'https://example.com/about/',
			'https://example.com/posts/hello/#later',
			'https://example.com/posts/'
		]);
	});

	it('links bare URLs, as linkify does on the page', () => {
		const [block] = convert('see https://example.org/x for more').blocks;
		expect(text(block).facets).toEqual([facet(4, 25, link('https://example.org/x'))]);
	});

	it("leaves links as plain text when they can't be resolved", () => {
		const [block] = convert('[relative](/about/) and [absolute](https://a.example/)', {
			baseUrl: undefined
		}).blocks;
		expect(block).toEqual({
			$type: TEXT,
			plaintext: 'relative and absolute',
			facets: [facet(13, 21, link('https://a.example/'))]
		});
	});

	it('follows the site in whether a soft line break is a line break', () => {
		expect(text(convert('one\ntwo').blocks[0]).plaintext).toBe('one two');
		expect(text(convert('one\ntwo', { breaks: true }).blocks[0]).plaintext).toBe('one\ntwo');
		// a hard break is one either way
		expect(text(convert('one  \ntwo').blocks[0]).plaintext).toBe('one\ntwo');
		expect(text(convert('one\\\ntwo').blocks[0]).plaintext).toBe('one\ntwo');
	});

	it('collapses runs of spaces the way the page does, except in code', () => {
		const [block] = convert('a <span>  </span>  b `x  y`').blocks;
		expect(text(block).plaintext).toBe('a b x  y');
		// a space that ends one run swallows the one that starts the next
		expect(convert('[a ](https://x.example/) b').blocks[0]).toEqual({
			$type: TEXT,
			plaintext: 'a b',
			facets: [facet(0, 2, link('https://x.example/'))]
		});
		// but code keeps its spaces, and doesn't swallow the next run's
		expect(text(convert('`a ` b').blocks[0]).plaintext).toBe('a  b');
	});

	it('breaks lines at <br>, and drops other inline HTML', () => {
		expect(texts(convert('one<br>two <span>three</span>\n\n<br>edge<br/>').blocks)).toEqual([
			'one\ntwo three',
			'edge'
		]);
	});

	it("leaves inline SVGs and scripts out of a paragraph's text", () => {
		expect(
			texts(
				convert(
					'Icon <svg viewBox="0 0 1 1"><title>Star</title><path d=""/></svg> here <script>track()</script>done'
				).blocks
			)
		).toEqual(['Icon here done']);
		// a self-closing <svg/> hides nothing after it
		expect(texts(convert('a <svg/> b').blocks)).toEqual(['a b']);
		// and a stray closing tag doesn't hide anything either
		expect(texts(convert('a </svg> b').blocks)).toEqual(['a b']);
	});

	it('keeps emoji tokens, and drops links hidden from screen readers', () => {
		const md = new MarkdownIt();
		// what markdown-it-anchor and markdown-it-emoji leave in the token stream
		md.core.ruler.push('fake_plugins', (state) => {
			for (const token of state.tokens) {
				if (token.type !== 'inline') continue;
				const anchor = new state.Token('link_open', 'a', 1);
				anchor.attrs = [
					['href', '#title'],
					['aria-hidden', 'true']
				];
				const symbol = Object.assign(new state.Token('text', '', 0), { content: '#' });
				const emoji = Object.assign(new state.Token('emoji', '', 0), { content: '🎉' });
				token.children!.push(emoji, anchor, symbol, new state.Token('link_close', 'a', -1));
			}
			return true;
		});
		const source = '# Title\n\nText';
		expect(tokensToBlocks(md.parse(source, {}), { source }).blocks).toEqual([
			{ $type: 'pub.leaflet.blocks.header', level: 1, plaintext: 'Title🎉' },
			{ $type: TEXT, plaintext: 'Text🎉' }
		]);
	});
});

describe('headings', () => {
	it('keep their level and their formatting', () => {
		expect(convert('## Hello\n\n###### Six *deep*').blocks).toEqual([
			{ $type: 'pub.leaflet.blocks.header', level: 2, plaintext: 'Hello' },
			{
				$type: 'pub.leaflet.blocks.header',
				level: 6,
				plaintext: 'Six deep',
				facets: [facet(4, 8, 'italic')]
			}
		]);
		expect(convert('Setext\n===').blocks).toEqual([
			{ $type: 'pub.leaflet.blocks.header', level: 1, plaintext: 'Setext' }
		]);
	});

	it('link an image, since an image block can’t go in one', () => {
		expect(convert('# Title ![logo](/logo.png)').blocks).toEqual([
			{
				$type: 'pub.leaflet.blocks.header',
				level: 1,
				plaintext: 'Title logo',
				facets: [facet(6, 10, link('https://example.com/logo.png'))]
			}
		]);
		// without a page URL, the image's alt text is all that's left
		expect(
			convert('# A ![logo](/logo.png)\n\n# ![](/x.png)', { baseUrl: undefined }).blocks
		).toEqual([{ $type: 'pub.leaflet.blocks.header', level: 1, plaintext: 'A logo' }]);
	});
});

describe('code', () => {
	it('keeps a fenced block’s language, and only its first word', () => {
		expect(convert('```js\nconst a = 1\n```\n\n```ts title="x.ts"\nlet b\n```').blocks).toEqual([
			{ $type: CODE, plaintext: 'const a = 1', language: 'js' },
			{ $type: CODE, plaintext: 'let b', language: 'ts' }
		]);
	});

	it('gives fenced code without a language, and indented code, none', () => {
		expect(convert('```\n  spaced  out\n```\n\n    indented\n    code').blocks).toEqual([
			{ $type: CODE, plaintext: '  spaced  out' },
			{ $type: CODE, plaintext: 'indented\ncode' }
		]);
	});
});

describe('blockquotes', () => {
	it('flatten paragraphs, code, lists, and HTML into one block', () => {
		expect(
			convert('> one\n>\n> two\n>\n> ```\n> code\n> ```\n>\n> 1. a\n> 2. b\n>\n> <div>html</div>')
				.blocks
		).toEqual([
			{
				$type: 'pub.leaflet.blocks.blockquote',
				plaintext: 'one\n\ntwo\n\ncode\n1. a\n2. b\n\nhtml',
				facets: [facet(10, 14, 'code')]
			}
		]);
		expect(text(convert('> - a\n> - b').blocks[0]).plaintext).toBe('- a\n- b');
	});

	it('keep their formatting and flatten nested quotes', () => {
		expect(convert('> A quote with **formatting**\n>\n> > nested').blocks).toEqual([
			{
				$type: 'pub.leaflet.blocks.blockquote',
				plaintext: 'A quote with formatting\n\nnested',
				facets: [facet(13, 23, 'bold')]
			}
		]);
	});

	it('link an image in HTML inside them', () => {
		const [quote] = convert('> <img src="x.png" alt="X">\n>\n> after').blocks;
		expect(quote).toEqual({
			$type: 'pub.leaflet.blocks.blockquote',
			plaintext: 'X\n\nafter',
			facets: [facet(0, 1, link('https://example.com/posts/hello/x.png'))]
		});
	});

	it('mark <pre> inside them as code', () => {
		expect(convert('> <pre>\n> a  b\n> </pre>').blocks).toEqual([
			{
				$type: 'pub.leaflet.blocks.blockquote',
				plaintext: 'a  b',
				facets: [facet(0, 4, 'code')]
			}
		]);
	});

	it('leave nothing behind when empty, like empty headings and comments', () => {
		expect(convert('>\n\n#\n\n<!-- only -->').blocks).toEqual([]);
	});
});

describe('lists', () => {
	it('nest, with a list of the other kind in its own field', () => {
		const block = list(convert('- one\n  - one.a\n  1. one.i\n- two').blocks[0]);
		expect(block.$type).toBe('pub.leaflet.blocks.unorderedList');
		expect(itemText(block.children)).toEqual(['one', 'two']);
		const [one] = block.children;
		expect(one.$type).toBe('pub.leaflet.blocks.unorderedList#listItem');
		expect(itemText(one.children)).toEqual(['one.a']);
		expect(one.orderedListChildren?.$type).toBe('pub.leaflet.blocks.orderedList');
		expect(one.orderedListChildren?.children[0].$type).toBe(
			'pub.leaflet.blocks.orderedList#listItem'
		);
		expect(itemText(one.orderedListChildren?.children)).toEqual(['one.i']);
		expect(one.unorderedListChildren).toBeUndefined();
	});

	it('put an unordered list in an ordered item in its own field', () => {
		const block = list(convert('1. one\n   - a\n2. two').blocks[0]);
		expect(block.$type).toBe('pub.leaflet.blocks.orderedList');
		expect(block.startIndex).toBeUndefined();
		expect(itemText(block.children[0].unorderedListChildren?.children)).toEqual(['a']);
		expect(block.children[0].orderedListChildren).toBeUndefined();
	});

	it('merge sibling nested lists in one item', () => {
		// switching bullet characters starts a new list
		const ordered = list(convert('1. one\n   - a\n   * b\n2. two').blocks[0]);
		expect(itemText(ordered.children[0].unorderedListChildren?.children)).toEqual(['a', 'b']);
		const unordered = list(convert('- one\n  - a\n  * b').blocks[0]);
		expect(itemText(unordered.children[0].children)).toEqual(['a', 'b']);
	});

	it('keep an ordered list’s start, when it isn’t 1', () => {
		expect(list(convert('3. three\n4. four').blocks[0]).startIndex).toBe(3);
		expect(list(convert('1) one').blocks[0])).not.toHaveProperty('startIndex');
	});

	// known bug: `attrGet('start') || 1` reads a start of 0 as no start, so a
	// list numbered from 0 is published (and its textContent written) from 1
	it.fails('keep an ordered list’s start of 0', () => {
		const { blocks, textContent } = convert('0. zero\n1. one');
		expect(list(blocks[0]).startIndex).toBe(0);
		expect(textContent).toBe('0. zero\n1. one');
	});

	it('keep formatting in items, as facets on their content', () => {
		expect(list(convert('- **bold** item').blocks[0]).children[0].content).toEqual({
			$type: TEXT,
			plaintext: 'bold item',
			facets: [facet(0, 4, 'bold')]
		});
	});

	it('join code, HTML, and quotes in an item into its text', () => {
		const block = list(
			convert('- item\n\n  ```js\n  x\n  ```\n\n  <p>html</p>\n- > quoted\n- next').blocks[0]
		);
		expect(block.children[0].content).toEqual({
			$type: TEXT,
			plaintext: 'item\nx\nhtml',
			facets: [facet(5, 6, 'code')]
		});
		expect(itemText(block.children.slice(1))).toEqual(['quoted', 'next']);
	});

	it('link images, since an image block can’t go in one', () => {
		const [items] = convert('- ![](/a.png)\n- <img src="/x.png" alt="X"> marks the spot').blocks;
		// with no alt text, the link's text is its URL
		expect(list(items).children.map((item) => item.content)).toEqual([
			{
				$type: TEXT,
				plaintext: 'https://example.com/a.png',
				facets: [facet(0, 25, link('https://example.com/a.png'))]
			},
			{
				$type: TEXT,
				plaintext: 'X marks the spot',
				facets: [facet(0, 1, link('https://example.com/x.png'))]
			}
		]);
	});

	it('have empty content for an empty item', () => {
		expect(itemText(list(convert('- \n- b').blocks[0]).children)).toEqual(['', 'b']);
	});

	it('skip tokens a plugin puts between items', () => {
		const tokens = new MarkdownIt().parse('- a\n- b', {});
		const TokenClass = tokens[0].constructor as typeof Token;
		// after the first item closes
		tokens.splice(6, 0, new TokenClass('divider', '', 0));
		expect(itemText(list(tokensToBlocks(tokens).blocks[0]).children)).toEqual(['a', 'b']);
	});
});

describe('other blocks', () => {
	it('turns a thematic break into a horizontal rule', () => {
		expect(convert('a\n\n---\n\n***').blocks).toEqual([
			{ $type: TEXT, plaintext: 'a' },
			{ $type: 'pub.leaflet.blocks.horizontalRule' },
			{ $type: 'pub.leaflet.blocks.horizontalRule' }
		]);
	});

	it('copies a table out of the source as code, since leaflet has no tables', () => {
		const source = 'Before\n\n| a | b |\n|---|---|\n| 1 | **2** |\n\nAfter';
		expect(convert(source).blocks).toEqual([
			{ $type: TEXT, plaintext: 'Before' },
			{ $type: CODE, plaintext: '| a | b |\n|---|---|\n| 1 | **2** |' },
			{ $type: TEXT, plaintext: 'After' }
		]);
		// with no source to copy from, it's an empty code block
		const md = new MarkdownIt();
		expect(tokensToBlocks(md.parse('| a |\n|---|', {})).blocks).toEqual([
			{ $type: CODE, plaintext: '' }
		]);
	});

	it('throws on a token stream that never closes a block', () => {
		const tokens = new MarkdownIt().parse('> quote', {}).slice(0, -1);
		expect(() => tokensToBlocks(tokens)).toThrow('Unclosed blockquote_open');
	});
});

describe('token streams from plugins', () => {
	const TokenClass = new MarkdownIt().parse('x', {})[0].constructor as typeof Token;

	it('treat inline tokens without children as empty', () => {
		const tokens = new MarkdownIt().parse('# Head\n\npara\n\n> quote\n\n- item', {});
		for (const token of tokens) if (token.type === 'inline') token.children = null;
		expect(tokensToBlocks(tokens).blocks).toEqual([
			{
				$type: 'pub.leaflet.blocks.unorderedList',
				children: [
					{
						$type: 'pub.leaflet.blocks.unorderedList#listItem',
						content: { $type: TEXT, plaintext: '' }
					}
				]
			}
		]);
	});

	it('ignore a link that closes without opening', () => {
		const tokens = new MarkdownIt().parse('para', {});
		tokens[1].children!.push(
			new TokenClass('link_close', 'a', -1),
			Object.assign(new TokenClass('text', '', 0), { content: ' after' })
		);
		expect(tokensToBlocks(tokens).blocks).toEqual([{ $type: TEXT, plaintext: 'para after' }]);
	});

	it('take a table without a source map as empty', () => {
		const tokens = new MarkdownIt().parse('| a |\n|---|', {});
		tokens[0].map = null;
		expect(tokensToBlocks(tokens, { source: '| a |\n|---|' }).blocks).toEqual([
			{ $type: CODE, plaintext: '' }
		]);
	});

	// known bug: Converter.href hands null straight to new URL, which reads it
	// as the relative URL "null", so a link token without an href links its
	// text to <baseUrl>/null (markdown-it always sets one; a plugin might not)
	it.fails('leave a link without an href as plain text', () => {
		const tokens = new MarkdownIt().parse('[text](https://a.example/) and more', {});
		tokens[1].children![0].attrs = [];
		expect(tokensToBlocks(tokens, { baseUrl: BASE_URL }).blocks).toEqual([
			{ $type: TEXT, plaintext: 'text and more' }
		]);
	});
});

describe('images', () => {
	it('become pending blocks with a link to fall back on', () => {
		const { blocks } = convert('Before ![a cat](/img/cat.png "Title") after');
		expect(texts(blocks)).toEqual(['Before', '[image /img/cat.png]', 'after']);
		expect(blocks[1]).toEqual({
			pending: 'image',
			src: '/img/cat.png',
			url: 'https://example.com/img/cat.png',
			alt: 'a cat',
			fallback: {
				$type: TEXT,
				plaintext: 'a cat',
				facets: [facet(0, 5, link('https://example.com/img/cat.png'))]
			}
		});
	});

	it('fall back to their URL when they have no alt text', () => {
		const image = pending(convert('![](pic.png)').blocks[0]);
		expect(image.alt).toBe('');
		expect(image.fallback.plaintext).toBe('https://example.com/posts/hello/pic.png');
	});

	it('are left out when there’s no page URL to find them at', () => {
		expect(convert('a ![x](/x.png) b', { baseUrl: undefined }).blocks).toEqual([
			{ $type: TEXT, plaintext: 'a' },
			{ $type: TEXT, plaintext: 'b' }
		]);
	});

	it('keep the link they sit in on the text either side', () => {
		const { blocks } = convert('[before ![img](/a.png) after](https://x.example/)');
		expect(blocks).toEqual([
			{ $type: TEXT, plaintext: 'before', facets: [facet(0, 6, link('https://x.example/'))] },
			expect.objectContaining({ pending: 'image', src: '/a.png' }),
			{ $type: TEXT, plaintext: 'after', facets: [facet(0, 5, link('https://x.example/'))] }
		]);
	});

	it('become blocks when a shortcode’s <img> sits in a paragraph', () => {
		// what an image shortcode outputs, inside a markdown paragraph
		const { blocks } = convert(
			'Before <picture><source type="image/webp" srcset="/img/cat.webp"><img alt=\'Cat\' src=/img/cat.jpeg></picture> after'
		);
		expect(texts(blocks)).toEqual(['Before', '[image /img/cat.jpeg]', 'after']);
		expect(pending(blocks[1]).alt).toBe('Cat');
	});

	it('are dropped inside something a reader doesn’t see', () => {
		expect(texts(convert('a <svg><img src="x.png"></svg> b').blocks)).toEqual(['a b']);
	});
});

describe('Bluesky posts', () => {
	const url = 'https://bsky.app/profile/bnb.im/post/3mwvwapoefs26';

	it('embed when a bare post link is on its own line', () => {
		expect(convert(url).blocks).toEqual([
			{
				pending: 'bskyPost',
				url,
				fallback: { $type: TEXT, plaintext: url, facets: [facet(0, url.length, link(url))] }
			}
		]);
		// a trailing slash on either side is fine
		expect(pending(convert(`[${url}/](${url})`).blocks[0]).pending).toBe('bskyPost');
	});

	it('stay links with other text around them, or other link text', () => {
		expect(pending(convert(`see ${url}`).blocks[0]).pending).toBeUndefined();
		expect(
			pending(
				convert('[https://bsky.app/profile/a.b/post/3k](https://bsky.app/profile/a.b/post/3x)')
					.blocks[0]
			).pending
		).toBeUndefined();
		expect(pending(convert(`[the post](${url})`).blocks[0]).pending).toBeUndefined();
		expect(pending(convert('https://bsky.app/profile/a.b').blocks[0]).pending).toBeUndefined();
	});

	it('stay links with blueskyPosts off', () => {
		expect(convert(url, { blueskyPosts: false }).blocks).toEqual([
			{ $type: TEXT, plaintext: url, facets: [facet(0, url.length, link(url))] }
		]);
	});
});

describe('HTML blocks', () => {
	it('keep the text a reader sees, and drop scripts, styles, and the like', () => {
		const { blocks } = convert(
			[
				"<script>\nconsole.log('hi')\n</script>",
				'<style>\n.x { color: red }\n</style>',
				'<div>\n<svg viewBox="0 0 1 1"><title>Icon</title></svg>\n<noscript>Turn on JS</noscript>\nAfter &mdash; &#x2014; &copy; &#99999999;\n</div>',
				'<figure>\n<img src="cat%20pic.png" alt="A &quot;cat&quot;">\n<figcaption>Caption</figcaption>\n</figure>',
				'<pre><code class="language-js">\nif (a &lt; b) {}\n</code></pre>',
				'<pre></pre>'
			].join('\n\n')
		);
		expect(blocks).toEqual([
			{ $type: TEXT, plaintext: 'After — — © �' },
			{
				pending: 'image',
				src: 'cat%20pic.png',
				url: 'https://example.com/posts/hello/cat%20pic.png',
				alt: 'A "cat"',
				fallback: {
					$type: TEXT,
					plaintext: 'A "cat"',
					facets: [facet(0, 7, link('https://example.com/posts/hello/cat%20pic.png'))]
				}
			},
			{ $type: TEXT, plaintext: 'Caption' },
			{ $type: CODE, plaintext: 'if (a < b) {}' }
		]);
	});

	it('split into paragraphs on block tags, with whitespace collapsed', () => {
		expect(
			texts(
				convert(
					'<section>\n  <p>One\n   two</p><p>Three<br>four</p>\n  <ul><li>Five</li></ul>\n</section>'
				).blocks
			)
		).toEqual(['One two', 'Three\nfour', 'Five']);
	});

	it('drop comments, and an <img> with nowhere to point', () => {
		expect(convert('<!-- a comment -->\n\n<div><img alt="no src"></div>').blocks).toEqual([]);
	});
});

describe('textContent', () => {
	it('is a plain text version of the blocks', () => {
		expect(convert('# Title\n\nSome **text**.\n\n- a\n  - b\n\n1. c\n\n---').textContent).toBe(
			'Title\n\nSome text.\n\n- a\n  - b\n\n1. c'
		);
	});

	it('numbers ordered lists from their start, and nested ones from 1', () => {
		expect(convert('3. a\n   1. b\n   2. c\n4. d').textContent).toBe('3. a\n  1. b\n  2. c\n4. d');
		expect(convert('- a\n  1. b\n  - c').textContent).toBe('- a\n  - c\n  1. b');
	});

	it('uses the link text for images and posts', () => {
		expect(convert('![a cat](/cat.png)\n\nhttps://bsky.app/profile/a.b/post/3k').textContent).toBe(
			'a cat\n\nhttps://bsky.app/profile/a.b/post/3k'
		);
	});

	it('is what plainText makes of the blocks', () => {
		const { blocks, textContent } = convert('One\n\n- two\n\n```\nthree\n```');
		expect(plainText(blocks)).toBe(textContent);
		expect(plainText([])).toBe('');
	});
});

describe('toContent', () => {
	it('wraps the blocks in one linear page', () => {
		const blocks: Block[] = [
			{ $type: TEXT, plaintext: 'Hi' },
			{ $type: 'pub.leaflet.blocks.horizontalRule' }
		];
		expect(toContent(blocks)).toEqual({
			$type: 'pub.leaflet.content',
			pages: [
				{
					$type: 'pub.leaflet.pages.linearDocument',
					blocks: [
						{ $type: 'pub.leaflet.pages.linearDocument#block', block: blocks[0] },
						{ $type: 'pub.leaflet.pages.linearDocument#block', block: blocks[1] }
					]
				}
			]
		});
	});
});

it('leaves no markup in what a reader sees', () => {
	const { blocks } = convert(
		'Escaped \\*stars\\* and &copy; &amp; &#8212;\n\n<p>A <b>tag</b> &mdash; gone</p>\n\n`<kept>`'
	);
	expect(texts(blocks)).toEqual(['Escaped *stars* and © & —', 'A tag — gone', '<kept>']);
	assertNoMarkup(blocks);
});

describe('an image whose alt text is only whitespace', () => {
	it('falls back to a link labelled with its URL', () => {
		const { blocks, textContent } = tokensToBlocks(
			new MarkdownIt({ html: true }).parse('<img src="x.png" alt="\n  ">', {}),
			{ baseUrl: 'https://example.com/post/' }
		);
		expect(blocks).toMatchObject([
			{
				pending: 'image',
				url: 'https://example.com/post/x.png',
				fallback: { plaintext: 'https://example.com/post/x.png' }
			}
		]);
		expect(textContent).toBe('https://example.com/post/x.png');
	});
});
