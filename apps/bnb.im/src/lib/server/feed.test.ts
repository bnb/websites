import { afterEach, describe, expect, it, vi } from 'vitest';
import { atomFeed, escapeXml } from './feed';
import type { Post } from './posts';

function post(slug: string, date: string, extra: Partial<Post> = {}): Post {
	return {
		slug,
		file: `/posts/${slug}.md`,
		url: `/posts/${slug}/`,
		title: slug,
		date: new Date(date),
		tags: ['post'],
		draft: false,
		source: '',
		html: '<p>Hello.</p>\n',
		...extra
	};
}

describe('escapeXml', () => {
	it('escapes what the feed has always escaped', () => {
		expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
			'&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;'
		);
	});

	it('escapes backslashes', () => {
		expect(escapeXml('C:\\path\\to')).toBe('C:&#92;path&#92;to');
	});

	it('leaves everything else alone', () => {
		expect(escapeXml('plain text, 🦋 and ${{ matrix.os }}')).toBe(
			'plain text, 🦋 and ${{ matrix.os }}'
		);
	});
});

describe('atomFeed', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	const posts = [
		post('first-post', '2019-04-15', { title: 'My 🔥 First <Post>' }),
		post('second', '2021-06-17', {
			title: `"Quotes" & 'apostrophes'`,
			html: '<p>See <a href="#setup">setup</a>.<br>\n<img src="shot.png" alt=""></p>\n'
		})
	];

	it('starts with the XML declaration and the feed metadata', async () => {
		const xml = await atomFeed(posts);
		expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n')).toBe(true);
		expect(xml).toContain(
			'<feed xmlns="http://www.w3.org/2005/Atom">\n' +
				'  <title>Tierney Cyren</title>\n' +
				'  <subtitle>Software and Selected Garbage</subtitle>\n' +
				'  <link href="https://bnb.im/feed.xml" rel="self"/>\n' +
				'  <link href="https://bnb.im/"/>\n' +
				'  <updated>2021-06-17T00:00:00Z</updated>\n' +
				'  <id>https://bnb.im/</id>\n' +
				'  <author>\n' +
				'    <name>Tierney Cyren</name>\n' +
				'    <email>hello@bnb.im</email>\n' +
				'  </author>'
		);
		expect(xml.endsWith('\n  </entry>\n</feed>\n')).toBe(true);
	});

	it('is updated when the newest post was, whatever the order', async () => {
		const xml = await atomFeed(posts.toReversed());
		expect(xml).toContain('  <updated>2021-06-17T00:00:00Z</updated>\n  <id>');
	});

	it('lists every post in the order given, oldest first', async () => {
		const xml = await atomFeed(posts);
		const ids = Array.from(xml.matchAll(/<id>(.*?)<\/id>/g), (match) => match[1]);
		expect(ids).toEqual([
			'https://bnb.im/',
			'https://bnb.im/posts/first-post/',
			'https://bnb.im/posts/second/'
		]);
	});

	it('writes each entry with an escaped title, its link, date and id', async () => {
		const xml = await atomFeed(posts);
		expect(xml).toContain(
			'\n  \n  <entry>\n' +
				'    <title>My 🔥 First &lt;Post&gt;</title>\n' +
				'    <link href="https://bnb.im/posts/first-post/"/>\n' +
				'    <updated>2019-04-15T00:00:00Z</updated>\n' +
				'    <id>https://bnb.im/posts/first-post/</id>\n' +
				'    <content type="html">&lt;p&gt;Hello.&lt;/p&gt;\n</content>\n' +
				'  </entry>'
		);
		expect(xml).toContain('<title>&quot;Quotes&quot; &amp; &#39;apostrophes&#39;</title>');
	});

	it("escapes each post's HTML with its URLs made absolute", async () => {
		const xml = await atomFeed(posts);
		expect(xml).toContain(
			'<content type="html">' +
				'&lt;p&gt;See &lt;a href=&quot;https://bnb.im/posts/second/#setup&quot;&gt;setup&lt;/a&gt;.&lt;br /&gt;\n' +
				'&lt;img src=&quot;https://bnb.im/posts/second/shot.png&quot; alt=&quot;&quot; /&gt;&lt;/p&gt;\n' +
				'</content>'
		);
	});

	it('is updated now when there are no posts', async () => {
		vi.useFakeTimers({ now: new Date('2026-10-04T12:34:56.789Z') });
		const xml = await atomFeed([]);
		expect(xml).toContain('<updated>2026-10-04T12:34:56Z</updated>');
		expect(xml).not.toContain('<entry>');
		expect(xml.endsWith('  </author>\n</feed>\n')).toBe(true);
	});
});
