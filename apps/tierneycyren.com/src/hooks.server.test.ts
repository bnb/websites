import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { handle } from './hooks.server';
import { GET } from './routes/healthz/+server';

describe('server hooks and routes', () => {
	it('adds the security headers', async () => {
		const response = await handle({
			event: {} as RequestEvent,
			resolve: async () => new Response('page')
		});
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
	});

	it('answers the health check', async () => {
		const response = await GET({} as never);
		expect(await response.text()).toBe('ok');
	});
});
