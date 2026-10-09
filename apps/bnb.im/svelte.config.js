import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { contentSecurityPolicy } from '@bnb/kit/csp';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Every page is prerendered to plain HTML for GitHub Pages; see
		// src/routes/+layout.ts (no client-side JavaScript at all).
		adapter: adapter(),

		prerender: {
			// pages nothing links to: the 404 (GitHub Pages serves 404.html), and
			// the files standard.site and its subscribe button read
			entries: [
				'*',
				'/404',
				'/feed.xml',
				'/.well-known/site.standard.publication',
				'/oauth-client-metadata.json',
				'/oauth/callback/index.html'
			],
			// posts link their at:// records, which the crawler can't (and needn't) follow
			handleInvalidUrl: ({ href, message }) => {
				if (!href.startsWith('at://')) throw new Error(message);
			}
		},

		inlineStyleThreshold: 16_384,

		// Static hosting means the policy arrives in a <meta> tag, where
		// frame-ancestors is ignored, so it's left out. Images: Bluesky embeds and
		// post screenshots. Connections: the subscribe button's OAuth sign-in talks
		// to whichever PDS and handle resolver a reader uses.
		csp: contentSecurityPolicy({
			images: ['https:'],
			connect: ['https:'],
			frameAncestors: false
		})
	}
};

export default config;
