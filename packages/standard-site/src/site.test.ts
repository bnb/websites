import { siteUrlFor } from '@bnb/atmosphere';
import { describe, expect, it } from 'vitest';
import { SCOPE } from './constants';
import {
	callbackPage,
	clientMetadata,
	DEFAULT_HANDLE_RESOLVER,
	headTags,
	normalizeSiteUrl,
	type Site
} from './site';

const PUBLICATION = 'at://did:plc:author/site.standard.publication/3lpub2222222';
const DOCUMENT = 'at://did:plc:author/site.standard.document/3ldoc2222222';

const site = (fields: Partial<Site> = {}): Site => ({
	url: 'https://example.com/blog',
	publication: { uri: PUBLICATION, name: 'Notes' },
	...fields
});

describe('normalizeSiteUrl', () => {
	it('drops the trailing slash, query, and hash', () => {
		expect(normalizeSiteUrl('https://example.com/')).toBe('https://example.com');
		expect(normalizeSiteUrl('https://Example.COM/blog//?ref=feed#top')).toBe(
			'https://example.com/blog'
		);
		expect(normalizeSiteUrl('http://localhost:8080/')).toBe('http://localhost:8080');
	});

	it("refuses what isn't an http(s) URL", () => {
		expect(() => normalizeSiteUrl('example.com')).toThrow("`siteUrl` isn't a URL: example.com");
		expect(() => normalizeSiteUrl('ftp://example.com/')).toThrow(
			'`siteUrl` needs to be an http(s) URL: ftp://example.com/'
		);
	});
});

describe('siteUrlFor', () => {
	it('puts a site path under the base URL, subdirectory and all', () => {
		expect(siteUrlFor('https://example.com', '/posts/a/')).toBe('https://example.com/posts/a/');
		expect(siteUrlFor('https://example.com/blog', '/posts/a/')).toBe(
			'https://example.com/blog/posts/a/'
		);
		expect(siteUrlFor('https://example.com/blog/', 'posts/a/')).toBe(
			'https://example.com/blog/posts/a/'
		);
		expect(siteUrlFor('https://example.com/blog///', '/')).toBe('https://example.com/blog/');
	});
});

describe('headTags', () => {
	it('names the author on every page', () => {
		expect(headTags(PUBLICATION)).toEqual([{ name: 'at:me', content: 'at://did:plc:author' }]);
	});

	it("ties a post's page to its record", () => {
		expect(headTags(PUBLICATION, DOCUMENT)).toEqual([
			{ name: 'at:me', content: 'at://did:plc:author' },
			{ name: 'at:canonical', content: DOCUMENT },
			{ name: 'at:alternate', content: PUBLICATION },
			{ name: 'at:author', content: 'at://did:plc:author' },
			{ rel: 'site.standard.document', href: DOCUMENT },
			{ rel: 'site.standard.publication', href: PUBLICATION }
		]);
	});

	it('needs a publication URI', () => {
		expect(() => headTags('https://example.com/')).toThrow('Not an at:// record URI');
	});
});

describe('clientMetadata', () => {
	it('describes the browser OAuth client, under the site’s subdirectory', () => {
		expect(clientMetadata(site())).toEqual({
			client_id: 'https://example.com/blog/oauth-client-metadata.json',
			client_name: 'Notes',
			client_uri: 'https://example.com/blog/',
			redirect_uris: ['https://example.com/blog/oauth/callback/'],
			scope: SCOPE,
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'none',
			application_type: 'web',
			dpop_bound_access_tokens: true
		});
		// subscriptions, upvotes and comments, created and deleted, and nothing else
		expect(SCOPE).toBe(
			'atproto repo:site.standard.graph.subscription?action=create&action=delete repo:at.upvote.signal?action=create&action=delete repo:at.upvote.comment?action=create&action=delete'
		);
	});
});

describe('callbackPage', () => {
	it('loads the subscribe script from two levels up, so it works under a subdirectory', () => {
		const html = callbackPage(site());
		expect(html.startsWith('<!DOCTYPE html>\n<html lang="en" data-standard-site-callback ')).toBe(
			true
		);
		expect(html).toContain(
			'<script type="module" src="../../standard-site/subscribe.js"></script>'
		);
		expect(html).toContain(
			'<p data-standard-site-status>Finishing your subscription to Notes…</p>'
		);
		expect(html).toContain('<meta name="robots" content="noindex">');
		expect(html).toContain(`data-handle-resolver="${DEFAULT_HANDLE_RESOLVER}"`);
		expect(DEFAULT_HANDLE_RESOLVER).toBe('https://api.bsky.app');
	});

	it('escapes the publication name and handle resolver', () => {
		const html = callbackPage(
			site({
				publication: { uri: PUBLICATION, name: `Tom & Jerry's <"Notes">` },
				handleResolver: 'https://resolver.example/?a=1&b="2"'
			})
		);
		expect(html).toContain(
			'data-handle-resolver="https://resolver.example/?a=1&amp;b=&quot;2&quot;"'
		);
		expect(html).toContain('subscription to Tom &amp; Jerry&#39;s &lt;&quot;Notes&quot;&gt;…');
		expect(html).not.toContain('<"Notes">');
	});
});
