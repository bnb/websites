import { captureLogs } from '@bnb/testing/logs';
import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { handle } from './hooks.server';
import { GET } from './routes/healthz/+server';

const home = () =>
	({
		request: new Request('http://localhost/'),
		url: new URL('http://localhost/'),
		locals: {}
	}) as RequestEvent;

describe('server hooks and routes', () => {
	it('adds the security headers, and logs the request as one wide event', async () => {
		const logs = captureLogs({ service: 'tierneycyren.com' });
		const response = await handle({ event: home(), resolve: async () => new Response('page') });
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		await vi.waitFor(() =>
			expect(logs).toContainEqual(expect.objectContaining({ path: '/', status: 200 }))
		);
	});

	it('answers the health check', async () => {
		const response = await GET({} as never);
		expect(await response.text()).toBe('ok');
	});
});
