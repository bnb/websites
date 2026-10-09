import { afterEach, describe, expect, it, vi } from 'vitest';

const loadCrate = vi.fn();
vi.mock('../plyr', () => ({ loadCrate }));

// the cache reads the clock when it's created, so each test imports it fresh
async function freshCrate() {
	vi.resetModules();
	return (await import('./crate')).crate;
}

describe('crate', () => {
	afterEach(() => {
		vi.useRealTimers();
		loadCrate.mockReset();
	});

	it('reads through the cache with a timed-out fetch', async () => {
		const crate = await freshCrate();
		loadCrate.mockResolvedValue({ bio: '', mixes: [], pds: 'https://pds.example' });
		await expect(crate.get()).resolves.toMatchObject({ pds: 'https://pds.example' });
		await crate.get();
		expect(loadCrate).toHaveBeenCalledOnce();
		expect(typeof loadCrate.mock.calls[0][0]).toBe('function');
	});

	it('logs a failed background refresh and keeps serving the last mixes', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const crate = await freshCrate();
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		loadCrate
			.mockResolvedValueOnce({ bio: '', mixes: [], pds: 'https://pds.example' })
			.mockRejectedValueOnce(new Error('PDS down'));

		await crate.get();
		vi.setSystemTime(Date.now() + 10 * 60_000);
		await expect(crate.get()).resolves.toMatchObject({ pds: 'https://pds.example' });
		await vi.waitFor(() =>
			expect(error).toHaveBeenCalledWith(
				'Background refresh from the AT Protocol failed',
				expect.any(Error)
			)
		);
	});
});
