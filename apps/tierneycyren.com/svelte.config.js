import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { contentSecurityPolicy } from '@bnb/kit/csp';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// adapter-node, like tierney.camera: the mixes are read live from the
		// AT Protocol on each (cached) request.
		adapter: adapter(),

		inlineStyleThreshold: 16_384,

		// Covers and audio come from plyr.fm's CDNs, with the raw blob from
		// whichever PDS hosts the account as the fallback, hence https:.
		csp: contentSecurityPolicy({ images: ['https:'], media: ['https:'] })
	}
};

export default config;
