import { dev } from '$app/environment';
import { requestLogging, securityHeaders } from '@bnb/kit/server';

// One wide event per request (see @bnb/kit's requestLogging) around baseline
// security headers for every server-rendered response (the CSP comes from
// SvelteKit, see svelte.config.js), and a preload for the Latin cut of the
// display face, which the masthead is set in.
export const { handle, handleError } = requestLogging({
	service: 'tierney.camera',
	dev,
	handle: securityHeaders({ preloadFont: (path) => path.includes('archivo-latin-wdth') })
});
