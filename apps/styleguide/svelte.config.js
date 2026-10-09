import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// A SvelteKit project only so @storybook/sveltekit can mock $app/* for stories.
// It's never built as an app; `npm run build-storybook` makes the static site.
/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: vitePreprocess()
};
