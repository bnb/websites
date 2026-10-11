import { dev } from '$app/environment';
import { requestLogging, securityHeaders } from '@bnb/kit/server';

// One wide event per request (see @bnb/kit's requestLogging) around baseline
// security headers for every response (the CSP comes from SvelteKit, see
// svelte.config.js), and a preload for the Latin cut of the display face.
export const { handle, handleError } = requestLogging({
	service: 'tierneycyren.com',
	dev,
	handle: securityHeaders({ preloadFont: (path) => path.includes('archivo-latin-wdth') })
});
