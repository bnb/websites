import type { Reroute } from '@sveltejs/kit';

// The OAuth callback is prerendered as a file, oauth/callback/index.html, which
// static hosts serve at /oauth/callback/. This lets `vite dev` do the same.
export const reroute: Reroute = ({ url }) =>
	url.pathname === '/oauth/callback/' ? '/oauth/callback/index.html' : undefined;
