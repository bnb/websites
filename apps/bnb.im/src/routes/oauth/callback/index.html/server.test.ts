import { describe, expect, it } from 'vitest';
import { callbackPage } from '$lib/server/standard-site';
import { GET, prerender } from './+server';

describe('GET /oauth/callback/index.html', () => {
	it('serves the page readers land on after signing in', async () => {
		expect(prerender).toBe(true);
		const response = GET();
		expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');

		const html = await response.text();
		expect(html).toBe(callbackPage());
		expect(html).toContain('data-standard-site-callback');
		expect(html).toContain('src="../../standard-site/subscribe.js"');
	});
});
