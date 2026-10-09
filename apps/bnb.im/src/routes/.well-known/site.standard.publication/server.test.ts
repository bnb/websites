import { describe, expect, it } from 'vitest';
import { GET, prerender } from './+server';

describe('GET /.well-known/site.standard.publication', () => {
	it('names the publication, so readers can verify the site belongs to it', async () => {
		expect(prerender).toBe(true);
		const response = GET();
		expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
		expect(await response.text()).toBe(
			'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.publication/3mtxb2uyta22l'
		);
	});
});
