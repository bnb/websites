import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('GET /oauth-client-metadata.json', () => {
	it('describes the browser client that may only create and delete the reader’s likes', async () => {
		const response = await GET({} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/json');
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
		expect(await response.json()).toEqual({
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
