import { createRequestLogger } from 'evlog';
import { afterEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('$lib/server/portfolio', () => ({ portfolio: { get } }));
const palettesFor = vi.fn((_cids: readonly string[]) => ({}));
vi.mock('$lib/server/palette', () => ({ palettesFor }));

const { load } = await import('./+page.server');

type LoadEvent = Parameters<typeof load>[0];

async function run() {
	const setHeaders = vi.fn();
	const log = createRequestLogger();
	const data = await load({ locals: { log }, setHeaders } as unknown as LoadEvent);
	return {
		data,
		headers: setHeaders.mock.calls[0][0] as Record<string, string>,
		logged: log.getContext()
	};
}

describe('page load', () => {
	afterEach(() => get.mockReset());

	it('serves the portfolio with CDN-friendly caching', async () => {
		get.mockResolvedValue({ profile: null, photos: [], pds: 'https://pds.example' });
		const { data, headers } = await run();
		expect(data).toMatchObject({ loadError: false, pds: 'https://pds.example' });
		expect(headers['cache-control']).toContain('s-maxage=300');
		expect(headers['x-robots-tag']).toBeUndefined();
	});

	it('sends whichever colour strips are ready for its photographs', async () => {
		const swatches = [{ hex: '#d7ff3a', share: 1 }];
		palettesFor.mockImplementationOnce((cids) => ({ [cids[0]]: swatches }));
		get.mockResolvedValue({
			profile: null,
			photos: [{ cid: 'cid-a' }, { cid: 'cid-b' }],
			pds: 'https://pds.example'
		});
		const { data, logged } = await run();
		expect(data).toHaveProperty('palettes', { 'cid-a': swatches });
		expect(logged.portfolio).toEqual({ photos: 2, palettesReady: 1 });
	});

	it('keeps the outage page out of caches and search indexes', async () => {
		get.mockRejectedValue(new Error('PDS down'));
		const { data, headers, logged } = await run();
		expect(data).toMatchObject({ loadError: true, photos: [], palettes: {} });
		expect(headers).toEqual({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
		expect(logged).toMatchObject({ portfolio: { outage: true }, error: { message: 'PDS down' } });
	});
});
