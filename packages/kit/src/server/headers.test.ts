import type { RequestEvent, ResolveOptions } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { SECURITY_HEADERS, healthz, securityHeaders } from './index';

type Preload = NonNullable<ResolveOptions['preload']>;

async function run(handle: ReturnType<typeof securityHeaders>) {
	let options: ResolveOptions | undefined;
	const resolve = vi.fn(async (_event: RequestEvent, opts?: ResolveOptions) => {
		options = opts;
		return new Response('page');
	});
	const response = await handle({ event: {} as RequestEvent, resolve });
	const preload = options?.preload as Preload;
	return { response, preload: (type: string, path: string) => preload({ type, path } as never) };
}

describe('securityHeaders', () => {
	it('sets every baseline security header', async () => {
		const { response } = await run(securityHeaders());
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			expect(response.headers.get(name)).toBe(value);
		}
		expect(response.headers.get('strict-transport-security')).toContain('max-age=');
	});

	it('preloads scripts, styles and only the fonts it is asked to', async () => {
		const { preload } = await run(
			securityHeaders({ preloadFont: (path) => path.includes('archivo-latin-wdth') })
		);
		expect(preload('js', '/app.js')).toBe(true);
		expect(preload('css', '/app.css')).toBe(true);
		expect(preload('font', '/archivo-latin-wdth-normal.woff2')).toBe(true);
		expect(preload('font', '/ibm-plex-mono-latin-400.woff2')).toBe(false);
		expect(preload('asset', '/favicon.svg')).toBe(false);
	});

	it('preloads no fonts by default', async () => {
		const { preload } = await run(securityHeaders());
		expect(preload('font', '/archivo-latin-wdth-normal.woff2')).toBe(false);
	});
});

describe('healthz', () => {
	it('answers ok, uncached, as plain text', async () => {
		const response = healthz();
		expect(await response.text()).toBe('ok');
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(response.headers.get('content-type')).toBe('text/plain');
	});
});
