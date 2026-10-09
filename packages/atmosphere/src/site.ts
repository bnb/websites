// What a site serves so readers can sign in to it: where its OAuth metadata and
// callback page live, and the narrowest scope that does its job.

/** Where a site serves its OAuth client metadata (its client id). */
export const METADATA_PATH = '/oauth-client-metadata.json';
/** Where readers land after signing in. */
export const CALLBACK_PATH = '/oauth/callback/';

/** Local dev addresses. ATProto's loopback OAuth clients redirect to the first. */
export const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '[::1]'];

const TRAILING_SLASHES = /\/+$/;
const LEADING_SLASH = /^\//;

/** A site path (like a page's url) under the site's base URL, which may have a subdirectory. */
export const siteUrlFor = (siteUrl: string, pathname: string): string =>
	new URL(pathname.replace(LEADING_SLASH, ''), `${siteUrl.replace(TRAILING_SLASHES, '')}/`).href;

/**
 * Permission to create and delete records in these collections, and nothing
 * else: `atproto repo:<collection>?action=create&action=delete …`.
 */
export const repoScope = (...collections: string[]): string =>
	['atproto', ...collections.map((nsid) => `repo:${nsid}?action=create&action=delete`)].join(' ');

/** The site's /oauth-client-metadata.json: a public browser client, bound to DPoP. */
export function clientMetadata({ url, name, scope }: { url: string; name: string; scope: string }) {
	return {
		client_id: siteUrlFor(url, METADATA_PATH),
		client_name: name,
		client_uri: siteUrlFor(url, '/'),
		redirect_uris: [siteUrlFor(url, CALLBACK_PATH)],
		scope,
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		token_endpoint_auth_method: 'none',
		application_type: 'web',
		dpop_bound_access_tokens: true
	};
}
