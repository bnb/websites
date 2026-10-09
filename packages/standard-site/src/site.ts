// What a site serves for standard.site, whatever builds it: the tags that tie
// a page to its record, and the static files the subscribe button's browser
// OAuth uses. Everything is static, so it works on any host with no server.
import { clientMetadata as atmosphereMetadata } from '@bnb/atmosphere';
import { parseAtUri } from './aturi';
import { DOCUMENT, SCOPE, SCRIPT_PATH } from './constants';

export interface Publication {
	/** the site.standard.publication record */
	uri: string;
	name: string;
	description?: string;
	showInDiscover?: boolean;
}

export interface Site {
	/** the site's full URL, including any subdirectory */
	url: string;
	publication: Publication;
	/** resolves the handle a reader types when subscribing */
	handleResolver?: string;
}

export const DEFAULT_HANDLE_RESOLVER = 'https://api.bsky.app';

const TRAILING_SLASHES = /\/+$/;

/** The site's base URL, without a trailing slash, query or hash. */
export function normalizeSiteUrl(siteUrl: string): string {
	let url: URL;
	try {
		url = new URL(siteUrl);
	} catch {
		throw new Error(`\`siteUrl\` isn't a URL: ${siteUrl}`);
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error(`\`siteUrl\` needs to be an http(s) URL: ${siteUrl}`);
	}
	url.search = '';
	url.hash = '';
	return url.href.replace(TRAILING_SLASHES, '');
}

export type HeadTag = { name: string; content: string } | { rel: string; href: string };

/**
 * AT Tags (https://tangled.org/chrisshank.com/at-tags/) for every page; on a
 * post, also the link tags that tie the page to its record.
 */
export function headTags(publicationUri: string, documentUri?: string): HeadTag[] {
	const author = `at://${parseAtUri(publicationUri).did}`;
	const tags: HeadTag[] = [{ name: 'at:me', content: author }];
	if (documentUri) {
		tags.push(
			{ name: 'at:canonical', content: documentUri },
			{ name: 'at:alternate', content: publicationUri },
			{ name: 'at:author', content: author },
			{ rel: DOCUMENT, href: documentUri },
			{ rel: 'site.standard.publication', href: publicationUri }
		);
	}
	return tags;
}

/** /oauth-client-metadata.json: the OAuth client the subscribe button signs readers in with. */
export const clientMetadata = (site: Site) =>
	atmosphereMetadata({ url: site.url, name: site.publication.name, scope: SCOPE });

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};
const ESCAPED = /[&<>"']/g;
const escapeHtml = (value: string) => value.replace(ESCAPED, (char) => ESCAPES[char]);

/**
 * /oauth/callback/: where readers land after signing in. The script works out
 * the client id and callback URL from where it was loaded from, so the
 * relative src keeps working under a subdirectory.
 */
export function callbackPage(site: Site): string {
	const resolver = site.handleResolver ?? DEFAULT_HANDLE_RESOLVER;
	return `<!DOCTYPE html>
<html lang="en" data-standard-site-callback data-handle-resolver="${escapeHtml(resolver)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Subscribing…</title>
  <style>
    body { font: 1.125rem/1.5 system-ui, sans-serif; max-width: 32rem; margin: 20vh auto; padding: 0 1rem; color: #222; background: #fff; }
    @media (prefers-color-scheme: dark) { body { color: #eee; background: #111; } a { color: #9cf; } }
  </style>
</head>
<body>
  <p data-standard-site-status>Finishing your subscription to ${escapeHtml(site.publication.name)}…</p>
  <script type="module" src="../..${SCRIPT_PATH}"></script>
</body>
</html>
`;
}
