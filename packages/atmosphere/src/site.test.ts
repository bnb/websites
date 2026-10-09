import { describe, expect, it } from 'vitest';
import { clientMetadata, repoScope, siteUrlFor } from './site';

describe('repoScope', () => {
	it('asks to create and delete records in just the collections named', () => {
		expect(repoScope('social.grain.favorite')).toBe(
			'atproto repo:social.grain.favorite?action=create&action=delete'
		);
		expect(repoScope('at.upvote.signal', 'at.upvote.comment')).toBe(
			'atproto repo:at.upvote.signal?action=create&action=delete repo:at.upvote.comment?action=create&action=delete'
		);
	});
});

describe('siteUrlFor', () => {
	it('puts a path under the site, subdirectory and all', () => {
		expect(siteUrlFor('https://tierney.camera', '/oauth/callback/')).toBe(
			'https://tierney.camera/oauth/callback/'
		);
		expect(siteUrlFor('https://example.com/blog/', 'feed.xml')).toBe(
			'https://example.com/blog/feed.xml'
		);
		expect(siteUrlFor('https://example.com/blog//', '/')).toBe('https://example.com/blog/');
	});
});

describe('clientMetadata', () => {
	it('describes a public browser client bound to DPoP, with the site’s scope', () => {
		expect(
			clientMetadata({
				url: 'https://tierney.camera',
				name: 'tierney.camera',
				scope: repoScope('social.grain.favorite')
			})
		).toEqual({
			client_id: 'https://tierney.camera/oauth-client-metadata.json',
			client_name: 'tierney.camera',
			client_uri: 'https://tierney.camera/',
			redirect_uris: ['https://tierney.camera/oauth/callback/'],
			scope: 'atproto repo:social.grain.favorite?action=create&action=delete',
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'none',
			application_type: 'web',
			dpop_bound_access_tokens: true
		});
	});
});
