import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Portfolio } from '../types';

const { loadPortfolio } = vi.hoisted(() => ({
	loadPortfolio: vi.fn<(fetchFn: typeof fetch) => Promise<Portfolio>>()
}));
vi.mock('../atproto', () => ({ loadPortfolio }));

const MINUTE = 60_000;

const portfolioOf = (pds: string): Portfolio => ({ profile: null, photos: [], pds });

/** A fresh copy of the module, so each test starts with an empty cache on the fake clock. */
async function freshPortfolio() {
	vi.resetModules();
	return (await import('./portfolio')).portfolio;
}

describe('portfolio (server cache)', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-04T12:00:00Z') });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		loadPortfolio.mockReset();
	});

	it('reads the portfolio once, then serves it from memory while it is fresh', async () => {
		const portfolio = await freshPortfolio();
		loadPortfolio.mockResolvedValue(portfolioOf('https://pds.one'));

		await expect(portfolio.get()).resolves.toEqual(portfolioOf('https://pds.one'));
		vi.setSystemTime(Date.now() + 4 * MINUTE);
		await expect(portfolio.get()).resolves.toEqual(portfolioOf('https://pds.one'));
		expect(loadPortfolio).toHaveBeenCalledOnce();
	});

	it('refreshes in the background after five minutes, keeping the last good copy through a failure', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const portfolio = await freshPortfolio();
		loadPortfolio.mockResolvedValueOnce(portfolioOf('https://pds.one'));
		await portfolio.get();

		// stale: answered from memory at once, while a refresh fails behind it
		vi.setSystemTime(Date.now() + 5 * MINUTE);
		const outage = new Error('PDS down');
		loadPortfolio.mockRejectedValueOnce(outage);
		await expect(portfolio.get()).resolves.toEqual(portfolioOf('https://pds.one'));
		await vi.waitFor(() =>
			expect(error).toHaveBeenCalledWith('Background refresh from the AT Protocol failed', outage)
		);

		// the next refresh succeeds, and later reads get the new copy
		loadPortfolio.mockResolvedValueOnce(portfolioOf('https://pds.two'));
		await expect(portfolio.get()).resolves.toEqual(portfolioOf('https://pds.one'));
		await vi.waitFor(async () =>
			expect(await portfolio.get()).toEqual(portfolioOf('https://pds.two'))
		);
		expect(loadPortfolio).toHaveBeenCalledTimes(3);
	});

	it('makes the first caller wait, and surfaces a failure when nothing is cached', async () => {
		const portfolio = await freshPortfolio();
		loadPortfolio.mockRejectedValueOnce(new Error('PDS down'));
		await expect(portfolio.get()).rejects.toThrow('PDS down');

		loadPortfolio.mockResolvedValueOnce(portfolioOf('https://pds.one'));
		await expect(portfolio.get()).resolves.toEqual(portfolioOf('https://pds.one'));
	});

	it('reads through a fetch that gives up after eight seconds', async () => {
		const network = vi.fn(async () => new Response('{}'));
		vi.stubGlobal('fetch', network);
		const timeout = vi.spyOn(AbortSignal, 'timeout');
		const portfolio = await freshPortfolio();

		loadPortfolio.mockImplementationOnce(async (fetchFn) => {
			await fetchFn('https://plc.directory/did:plc:example');
			return portfolioOf('https://pds.one');
		});
		await portfolio.get();

		expect(network).toHaveBeenCalledWith(
			'https://plc.directory/did:plc:example',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
		expect(timeout).toHaveBeenCalledWith(8_000);
	});
});
