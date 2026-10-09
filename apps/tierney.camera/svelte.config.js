import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { appScriptHash, contentSecurityPolicy } from '@bnb/kit/csp';

const appScript = appScriptHash(new URL('./src/app.html', import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// vitePreprocess enables <script lang="ts"> and modern CSS in .svelte files
	preprocess: vitePreprocess(),
	kit: {
		// adapter-node → runs anywhere Node runs (Railway, Fly, a VPS, …).
		// Swap for adapter-static + `prerender` if you'd rather ship a snapshot.
		adapter: adapter(),

		// the stylesheets are small; inlining them saves render-blocking round trips
		inlineStyleThreshold: 16_384,

		// Images come from the atproto CDN, with a fallback to whichever PDS hosts
		// the account, hence https: for img-src. Connections: liking signs a reader
		// in and writes to their repo, which means talking to their handle resolver,
		// DID directory, PDS and authorization server, any of which can be any
		// host, so https: for connect-src too (as bnb.im's subscribe button has).
		csp: contentSecurityPolicy({
			scripts: appScript ? [appScript] : [],
			images: ['https:'],
			connect: ['https:']
		})
	}
};

export default config;
