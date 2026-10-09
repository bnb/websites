// Makes every URL in a post's HTML absolute against the post's URL, for the
// feed: readers can't resolve `#heading` links or relative images on their
// own. It's the same set of URL attributes, and the same XHTML-style void
// tags (<br />), the feed has always had, so it reads the same as it always
// has. Built for markdown-it's output: well-formed tags,
// attribute values quoted and escaped.

/** Tags and the attributes on them that hold URLs. */
const URL_ATTRIBUTES: Record<string, readonly string[]> = {
	a: ['href', 'ping'],
	area: ['href', 'ping'],
	audio: ['src'],
	base: ['href'],
	blockquote: ['cite'],
	button: ['formaction'],
	del: ['cite'],
	embed: ['src'],
	form: ['action'],
	iframe: ['src'],
	img: ['src', 'srcset'],
	input: ['formaction', 'src'],
	ins: ['cite'],
	link: ['href'],
	object: ['data'],
	q: ['cite'],
	script: ['src'],
	source: ['src', 'srcset'],
	track: ['src'],
	video: ['poster', 'src']
};

const VOID = new Set([
	'area',
	'base',
	'br',
	'col',
	'command',
	'embed',
	'hr',
	'img',
	'input',
	'keygen',
	'link',
	'menuitem',
	'meta',
	'param',
	'source',
	'track',
	'wbr'
]);

const START_TAG =
	/<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const LIST = /\s*,\s*/;
const SPACE = /\s+/;
const QUOTE_ENTITY = /&quot;/g;
const QUOTE = /"/g;

/** `new URL(url, base)`, leaving anything that won't parse alone. */
export function absoluteUrl(url: string, base: string): string {
	try {
		return new URL(url, base).toString();
	} catch {
		return url;
	}
}

function rewrite(name: string, value: string, base: string): string {
	if (name === 'srcset') {
		return value
			.split(LIST)
			.filter(Boolean)
			.map((candidate) => {
				const [url, ...descriptors] = candidate.trim().split(SPACE);
				return [absoluteUrl(url, base), ...descriptors].join(' ');
			})
			.join(', ');
	}
	if (name === 'ping') {
		return value
			.split(LIST)
			.filter(Boolean)
			.map((url) => absoluteUrl(url.trim(), base))
			.join(', ');
	}
	return absoluteUrl(value.trim(), base);
}

/** The HTML with its URLs made absolute against `base`. */
export function htmlToAbsoluteUrls(html: string, base: string): string {
	return html.replace(START_TAG, (tag, rawName: string, rawAttributes: string) => {
		const name = rawName.toLowerCase();
		const urls = URL_ATTRIBUTES[name];
		const isVoid = VOID.has(name);
		if (!urls && !isVoid) return tag;
		let attributes = '';
		for (const [, key, double, single, bare] of rawAttributes.matchAll(ATTRIBUTE)) {
			const value = double ?? single ?? bare ?? '';
			// a URL is read with its quotes unescaped (so `new URL` percent-encodes
			// them), and any left are escaped again
			const rewritten = urls?.includes(key.toLowerCase())
				? rewrite(key.toLowerCase(), value.replace(QUOTE_ENTITY, '"'), base).replace(
						QUOTE,
						'&quot;'
					)
				: value;
			attributes += ` ${key}="${rewritten}"`;
		}
		return `<${rawName}${attributes}${isVoid ? ' /' : ''}>`;
	});
}
