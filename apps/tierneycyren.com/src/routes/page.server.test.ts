import { afterEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('$lib/server/crate', () => ({ crate: { get } }));

const { load } = await import('./+page.server');

type LoadEvent = Parameters<typeof load>[0];

async function run() {
	const setHeaders = vi.fn();
	const data = await load({ setHeaders } as unknown as LoadEvent);
	return { data, headers: setHeaders.mock.calls[0][0] as Record<string, string> };
}

describe('page load', () => {
	afterEach(() => get.mockReset());

	it('serves the mixes with CDN-friendly caching', async () => {
		get.mockResolvedValue({ bio: 'girl rave dj', mixes: [], pds: 'https://pds.example' });
		const { data, headers } = await run();
		expect(data).toMatchObject({ loadError: false, bio: 'girl rave dj' });
		expect(headers['cache-control']).toContain('s-maxage=300');
	});

	it('keeps the outage page out of caches and search indexes', async () => {
		get.mockRejectedValue(new Error('PDS down'));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { data, headers } = await run();
		expect(data).toMatchObject({ loadError: true, mixes: [] });
		expect(headers).toEqual({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
	});
});
