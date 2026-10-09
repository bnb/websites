import { describe, expect, it } from 'vitest';
import { GET, prerender } from './+server';

describe('GET /feed.xml', () => {
	it('is prerendered', () => {
		expect(prerender).toBe(true);
	});

	it('serves every post as an Atom feed, oldest first', async () => {
		const response = await GET();
		expect(response.headers.get('content-type')).toBe('application/atom+xml; charset=utf-8');

		const xml = await response.text();
		expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<feed')).toBe(true);
		const links = Array.from(
			xml.matchAll(/<link href="(https:\/\/bnb\.im\/posts\/[^"]+)"\/>/g),
			(match) => match[1]
		);
		expect(links).toHaveLength(14);
		expect(links[0]).toBe('https://bnb.im/posts/my-first-experience-attending-tc39/');
		expect(links.at(-1)).toBe('https://bnb.im/posts/what-is-the-atmosphere/');
		expect(xml).toContain('<updated>2026-10-02T00:00:00Z</updated>\n  <id>https://bnb.im/</id>');
		expect(xml).toContain('<title>Jest and the `--changedSince` flag in GitHub Actions CI</title>');
	});

	it("leaves Bluesky links as links, since the feed is built from each post's own HTML", async () => {
		const xml = await (await GET()).text();
		expect(xml).not.toContain('bsky-embed');
		expect(xml).toContain(
			'&lt;a href=&quot;https://bsky.app/profile/bnb.im/post/3mwvwapoefs26&quot;&gt;'
		);
	});
});
