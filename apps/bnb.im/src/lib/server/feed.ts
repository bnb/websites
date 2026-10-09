import { rfc3339 } from '../dates';
import { AUTHOR, FEED, SITE_URL } from '../site';
import { absoluteUrl, htmlToAbsoluteUrls } from './absolute-urls';
import type { Post } from './posts';

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
	'\\': '&#92;'
};
const ESCAPED = /[&<>"'\\]/g;

/** HTML escaping, as the feed has always had it (including ' and \\). */
export const escapeXml = (value: string) => value.replace(ESCAPED, (char) => ESCAPES[char]);

/** The Atom feed: every post, oldest first, with its full HTML. */
export function atomFeed(posts: readonly Post[]): string {
	const updated = posts.length
		? new Date(Math.max(...posts.map((post) => post.date.getTime())))
		: new Date();

	const entries = posts.map((post) => {
		const url = absoluteUrl(post.url, `${SITE_URL}/`);
		// the whitespace is the old template's, so the feed is byte-for-byte what it was
		return `
  
  <entry>
    <title>${escapeXml(post.title)}</title>
    <link href="${escapeXml(url)}"/>
    <updated>${rfc3339(post.date)}</updated>
    <id>${escapeXml(url)}</id>
    <content type="html">${escapeXml(htmlToAbsoluteUrls(post.html, url))}</content>
  </entry>`;
	});

	return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(FEED.title)}</title>
  <subtitle>${escapeXml(FEED.subtitle)}</subtitle>
  <link href="${FEED.url}" rel="self"/>
  <link href="${SITE_URL}/"/>
  <updated>${rfc3339(updated)}</updated>
  <id>${SITE_URL}/</id>
  <author>
    <name>${escapeXml(AUTHOR.name)}</name>
    <email>${escapeXml(AUTHOR.email)}</email>
  </author>${entries.join('')}
</feed>
`;
}
