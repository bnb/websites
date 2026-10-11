import { captureLogs } from '@bnb/testing/logs';
import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { asError, requestLogging } from './logging';

// the inner hook, standing in for securityHeaders()
const { handle, handleError } = requestLogging({
	service: 'site',
	dev: false,
	handle: async ({ event, resolve }) => {
		const response = await resolve(event);
		response.headers.set('x-inner', 'ran');
		return response;
	}
});
const logs = captureLogs({ service: 'site' });

const requestTo = (path: string) =>
	({
		request: new Request(`http://localhost${path}`),
		url: new URL(`http://localhost${path}`),
		locals: {}
	}) as RequestEvent;

describe('requestLogging', () => {
	it('emits one wide event per request, with what the handler added', async () => {
		logs.length = 0;
		const response = await handle({
			event: requestTo('/og.png'),
			resolve: async (event) => {
				event.locals.log.set({ card: { complete: true } });
				return new Response('png', { status: 201 });
			}
		});

		expect(await response.text()).toBe('png');
		expect(response.headers.get('x-inner')).toBe('ran');
		await vi.waitFor(() => expect(logs).toHaveLength(1));
		expect(logs[0]).toMatchObject({
			service: 'site',
			level: 'info',
			method: 'GET',
			path: '/og.png',
			status: 201,
			card: { complete: true }
		});
	});

	it('leaves the health check out', async () => {
		logs.length = 0;
		const response = await handle({
			event: requestTo('/healthz'),
			resolve: async () => new Response('ok')
		});

		expect(await response.text()).toBe('ok');
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(logs).toEqual([]);
	});

	it('records an unhandled error on the request and answers with the safe message', async () => {
		logs.length = 0;
		const event = requestTo('/');
		await handle({
			event,
			resolve: async () => {
				const error = await handleError({
					error: new Error('PDS exploded'),
					event,
					status: 500,
					message: 'Internal Error'
				});
				expect(error).toEqual({ message: 'Internal Error', status: 500 });
				return new Response('error page', { status: 500 });
			}
		});

		await vi.waitFor(() => expect(logs).toHaveLength(1));
		expect(logs[0]).toMatchObject({
			level: 'error',
			status: 500,
			error: { message: 'PDS exploded' }
		});
	});

	it('logs a 404 as its status alone, without an error', async () => {
		logs.length = 0;
		const event = requestTo('/wp-login.php');
		await handle({
			event,
			resolve: async () => {
				const error = await handleError({
					error: new Error('Not found: /wp-login.php'),
					event,
					status: 404,
					message: 'Not Found'
				});
				expect(error).toBeUndefined();
				return new Response('not found', { status: 404 });
			}
		});

		await vi.waitFor(() => expect(logs).toHaveLength(1));
		expect(logs[0]).toMatchObject({ status: 404, path: '/wp-login.php' });
		expect(logs[0]).not.toHaveProperty('error');
	});
});

describe('asError', () => {
	it('passes errors through and wraps anything else', () => {
		const error = new TypeError('fetch failed');
		expect(asError(error)).toBe(error);
		expect(asError('timeout')).toEqual(new Error('timeout'));
	});
});
