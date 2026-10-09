import type { Handle } from '@sveltejs/kit';

/** Baseline security headers. The CSP itself comes from SvelteKit (see ../csp.js). */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
	// browsers only honour HSTS over HTTPS, so this is inert on localhost
	'strict-transport-security': 'max-age=63072000; includeSubDomains',
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'cross-origin-opener-policy': 'same-origin',
	'permissions-policy': 'camera=(), microphone=(), geolocation=()'
};

/**
 * A `handle` hook that adds SECURITY_HEADERS to every server-rendered response
 * and preloads JS, CSS and whichever font files `preloadFont` picks (the cut
 * of the display face above the fold, say).
 */
export function securityHeaders({
	preloadFont = () => false
}: { preloadFont?: (path: string) => boolean } = {}): Handle {
	return async ({ event, resolve }) => {
		const response = await resolve(event, {
			preload: ({ type, path }) =>
				type === 'js' || type === 'css' || (type === 'font' && preloadFont(path))
		});
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			response.headers.set(name, value);
		}
		return response;
	};
}
