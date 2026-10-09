import { securityHeaders } from '@bnb/kit/server';

// Baseline security headers for every response (the CSP comes from SvelteKit,
// see svelte.config.js), and a preload for the Latin cut of the display face.
export const handle = securityHeaders({
	preloadFont: (path) => path.includes('archivo-latin-wdth')
});
