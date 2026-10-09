import { describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from './fetch';

describe('fetchWithTimeout', () => {
	it('passes an abort signal along with the caller’s options', async () => {
		const fetchFn = vi.fn<typeof fetch>(async () => new Response('ok'));
		await fetchWithTimeout(8_000, fetchFn)('https://pds.example', {
			headers: { accept: 'application/json' }
		});

		const init = fetchFn.mock.calls[0][1];
		expect(init?.headers).toEqual({ accept: 'application/json' });
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		expect(init?.signal?.aborted).toBe(false);
	});

	it('aborts a request that runs past the timeout', async () => {
		// a fetch that only settles when its signal aborts, like a hung PDS
		const hung = vi.fn(
			(_input: RequestInfo | URL, init?: RequestInit) =>
				new Promise<Response>((_, reject) => {
					init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
				})
		);
		await expect(fetchWithTimeout(20, hung)('https://pds.example')).rejects.toThrow();
	});
});
