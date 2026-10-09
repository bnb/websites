import { describe, expect, it } from 'vitest';
import { clientMetadata } from '$lib/server/standard-site';
import { GET, prerender } from './+server';

describe('GET /oauth-client-metadata.json', () => {
	it('serves the OAuth client metadata as pretty-printed JSON', async () => {
		expect(prerender).toBe(true);
		const response = GET();
		expect(response.headers.get('content-type')).toBe('application/json');

		const body = await response.text();
		expect(body).toBe(`${JSON.stringify(clientMetadata(), null, 2)}\n`);
		expect(JSON.parse(body)).toMatchObject({
			client_id: 'https://bnb.im/oauth-client-metadata.json',
			redirect_uris: ['https://bnb.im/oauth/callback/']
		});
	});
});
