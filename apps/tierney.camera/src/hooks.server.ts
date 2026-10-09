import { securityHeaders } from '@bnb/kit/server';

// Baseline security headers for every server-rendered response (the CSP comes
// from SvelteKit, see svelte.config.js), and a preload for the Latin cut of the
// display face, which the masthead is set in.
export const handle = securityHeaders({
	preloadFont: (path) => path.includes('archivo-latin-wdth')
});
