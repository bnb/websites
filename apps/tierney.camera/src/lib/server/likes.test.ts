import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Photo, Portfolio } from '../types';

const { loadPortfolio } = vi.hoisted(() => ({
	loadPortfolio: vi.fn<(fetchFn: typeof fetch) => Promise<Portfolio>>()
}));
vi.mock('../atproto', () => ({ loadPortfolio }));

const MINUTE = 60_000;
const BUSHWICK = 'at://did:plc:author/social.grain.gallery/bushwick';
const RIDGEWOOD = 'at://did:plc:author/social.grain.gallery/ridgewood';

const photo = (uri: string, gallery?: string) => ({ uri, gallery }) as Photo;
const portfolioOf = (...photos: Photo[]): Portfolio => ({
	profile: null,
	photos,
	pds: 'https://pds.one'
});

/** Constellation behind a stubbed fetch: how many likes each gallery has, or a status to fail with. */
function constellation(answers: Record<string, number | Response>) {
	const fetch = vi.fn(async (input: string | URL | Request) => {
		const url = new URL(String(input));
		const answer = answers[url.searchParams.get('target')!];
		return answer instanceof Response ? answer : Response.json({ total: answer });
	});
	vi.stubGlobal('fetch', fetch);
	return () => fetch.mock.calls.map(([input]) => new URL(String(input)));
}

/** A fresh copy of the modules, so each test starts with empty caches on the fake clock. */
async function fresh() {
	vi.resetModules();
	return (await import('./likes')).likeCounts;
}

describe('like counts (server cache)', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-09T12:00:00Z') });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		loadPortfolio.mockReset();
	});

	it('asks Constellation once per gallery how many people have liked it', async () => {
		const requests = constellation({ [BUSHWICK]: 8, [RIDGEWOOD]: 0 });
		const timeout = vi.spyOn(AbortSignal, 'timeout');
		loadPortfolio.mockResolvedValue(
			portfolioOf(
				photo('at://photo/1', BUSHWICK),
				photo('at://photo/2', RIDGEWOOD),
				// two photos in one gallery share its likes, and one request
				photo('at://photo/3', BUSHWICK),
				photo('at://photo/loose')
			)
		);
		const likeCounts = await fresh();

		await expect(likeCounts.get()).resolves.toEqual({ [BUSHWICK]: 8, [RIDGEWOOD]: 0 });
		const urls = requests();
		expect(urls.map((url) => url.searchParams.get('target'))).toEqual([BUSHWICK, RIDGEWOOD]);
		for (const url of urls) {
			expect(url.origin + url.pathname).toBe('https://constellation.microcosm.blue/links/count');
			expect(url.searchParams.get('collection')).toBe('social.grain.favorite');
			expect(url.searchParams.get('path')).toBe('.subject');
		}
		expect(timeout).toHaveBeenCalledWith(8_000);
	});

	it('leaves out a gallery it couldn’t count, and still answers', async () => {
		constellation({ [BUSHWICK]: new Response('', { status: 502 }), [RIDGEWOOD]: 5 });
		loadPortfolio.mockResolvedValue(
			portfolioOf(photo('at://photo/1', BUSHWICK), photo('at://photo/2', RIDGEWOOD))
		);
		const likeCounts = await fresh();
		await expect(likeCounts.get()).resolves.toEqual({ [RIDGEWOOD]: 5 });
	});

	it('counts again at most every five minutes', async () => {
		const requests = constellation({ [BUSHWICK]: 8 });
		loadPortfolio.mockResolvedValue(portfolioOf(photo('at://photo/1', BUSHWICK)));
		const likeCounts = await fresh();

		await likeCounts.get();
		vi.setSystemTime(Date.now() + 4 * MINUTE);
		await expect(likeCounts.get()).resolves.toEqual({ [BUSHWICK]: 8 });
		expect(requests()).toHaveLength(1);

		vi.setSystemTime(Date.now() + MINUTE);
		constellation({ [BUSHWICK]: 9 });
		await likeCounts.get();
		await vi.waitFor(async () => expect(await likeCounts.get()).toEqual({ [BUSHWICK]: 9 }));
	});

	it('fails with the portfolio, so the page can show its outage', async () => {
		constellation({});
		loadPortfolio.mockRejectedValue(new Error('PDS down'));
		const likeCounts = await fresh();
		await expect(likeCounts.get()).rejects.toThrow('PDS down');
	});
});
