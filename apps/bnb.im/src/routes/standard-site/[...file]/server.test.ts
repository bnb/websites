import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/subscribe-client', () => ({
	clientFiles: () => ['chunks/oauth-ABC.js', 'subscribe.js'],
	clientFile: (file: string) => (file === 'subscribe.js' ? 'export {};' : null)
}));

const { GET, entries, prerender } = await import('./+server');

type Event = Parameters<typeof GET>[0];

describe('/standard-site/[...file]', () => {
	it('prerenders every file in the bundle', async () => {
		expect(prerender).toBe(true);
		expect(await entries()).toEqual([{ file: 'chunks/oauth-ABC.js' }, { file: 'subscribe.js' }]);
	});

	it('serves a script as JavaScript', async () => {
		const response = await GET({ params: { file: 'subscribe.js' } } as Event);
		expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
		expect(await response.text()).toBe('export {};');
	});

	it('is a 404 for anything else', () => {
		expect(() => GET({ params: { file: 'nope.js' } } as Event)).toThrow(
			expect.objectContaining({ status: 404 })
		);
	});
});
