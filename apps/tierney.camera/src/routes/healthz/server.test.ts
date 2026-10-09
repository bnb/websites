import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('GET /healthz', () => {
	it('answers "ok", uncached, without touching the AT Protocol', async () => {
		const response = await GET({} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('ok');
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(response.headers.get('content-type')).toBe('text/plain');
	});
});
