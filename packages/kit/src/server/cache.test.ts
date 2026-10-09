import { describe, expect, it, vi } from 'vitest';
import { swrCache } from './cache';

describe('swrCache', () => {
	it('loads once, serves fresh values from memory, and shares concurrent loads', async () => {
		const load = vi.fn().mockResolvedValue('a');
		const cache = swrCache(load, { freshMs: 1000, now: () => 0 });

		expect(await Promise.all([cache.get(), cache.get()])).toEqual(['a', 'a']);
		expect(await cache.get()).toBe('a');
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('serves the stale value immediately while refreshing in the background', async () => {
		let time = 0;
		const load = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
		const cache = swrCache(load, { freshMs: 1000, now: () => time });

		expect(await cache.get()).toBe('old');
		time = 5000;
		expect(await cache.get()).toBe('old');
		await vi.waitFor(async () => expect(await cache.get()).toBe('new'));
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('keeps the last good value when a refresh fails', async () => {
		let time = 0;
		const onError = vi.fn();
		const load = vi
			.fn<() => Promise<string>>(() => Promise.reject(new Error('pds down')))
			.mockResolvedValueOnce('good');
		const cache = swrCache(load, { freshMs: 1000, now: () => time, onError });

		await cache.get();
		time = 5000;
		expect(await cache.get()).toBe('good');
		await vi.waitFor(() => expect(onError).toHaveBeenCalled());
		expect(await cache.get()).toBe('good');
	});

	it('rejects when there is nothing cached yet, and retries on the next call', async () => {
		const load = vi.fn().mockRejectedValueOnce(new Error('pds down')).mockResolvedValueOnce('ok');
		const cache = swrCache(load, { freshMs: 1000 });

		await expect(cache.get()).rejects.toThrow('pds down');
		expect(await cache.get()).toBe('ok');
	});

	it('swallows a failed background refresh by default', async () => {
		let time = 0;
		const load = vi
			.fn<() => Promise<string>>(() => Promise.reject(new Error('pds down')))
			.mockResolvedValueOnce('good');
		const cache = swrCache(load, { freshMs: 1000, now: () => time });

		await cache.get();
		time = 5000;
		expect(await cache.get()).toBe('good');
		await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
		expect(await cache.get()).toBe('good');
	});
});
