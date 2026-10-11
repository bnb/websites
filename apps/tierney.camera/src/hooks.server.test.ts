import { captureLogs } from '@bnb/testing/logs';
import type { RequestEvent, ResolveOptions } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { handle } from './hooks.server';

const home = () =>
	({
		request: new Request('http://localhost/'),
		url: new URL('http://localhost/'),
		locals: {}
	}) as RequestEvent;

async function run() {
	const resolve = vi.fn(
		async (_event: RequestEvent, _options?: ResolveOptions) =>
			new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })
	);
	const response = await handle({ event: home(), resolve });
	const preload = resolve.mock.calls[0][1]?.preload;
	if (!preload) throw new Error('handle() passed no preload option to resolve()');
	return { response, preload };
}

describe('handle (server hook)', () => {
	it('logs each request as one wide event', async () => {
		const logs = captureLogs({ service: 'tierney.camera' });
		await run();
		await vi.waitFor(() =>
			expect(logs).toContainEqual(expect.objectContaining({ path: '/', status: 200 }))
		);
	});

	it('adds the baseline security headers to every page', async () => {
		const { response } = await run();
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
		expect(response.headers.get('strict-transport-security')).toContain('max-age=');
		expect(response.headers.get('content-type')).toBe('text/html');
	});

	it('preloads scripts, styles and the Latin cut of the display face, no other fonts', async () => {
		const { preload } = await run();
		const assets = '/_app/immutable/assets';

		expect(preload({ type: 'js', path: '/_app/immutable/entry/start.js' })).toBe(true);
		expect(preload({ type: 'css', path: `${assets}/0.css` })).toBe(true);
		expect(preload({ type: 'font', path: `${assets}/archivo-latin-wdth-normal.Bx1.woff2` })).toBe(
			true
		);
		expect(
			preload({ type: 'font', path: `${assets}/archivo-latin-ext-wdth-normal.Bx2.woff2` })
		).toBe(false);
		expect(
			preload({ type: 'font', path: `${assets}/ibm-plex-mono-latin-400-normal.Bx3.woff2` })
		).toBe(false);
	});
});
