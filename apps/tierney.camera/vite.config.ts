import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],

	test: {
		// Two projects: fast Node unit tests for the pure logic, and real-browser
		// component tests (via Playwright) for the Svelte components. Every story
		// is rendered and checked with axe by the styleguide (apps/styleguide).
		projects: [
			{
				extends: './vite.config.ts',
				// mocked wherever it's used, but found by the import in
				// @bnb/atmosphere/oauth all the same; optimizing it up front saves
				// Vite reloading mid-run
				optimizeDeps: { include: ['@atproto/oauth-client-browser'] },
				test: {
					name: 'client',
					// liking from localhost moves the page to 127.0.0.1 before signing
					// in, so the tests are served from there to begin with
					api: { host: '127.0.0.1' },
					// the files share one origin's storage, where a reader's sign-in is kept
					fileParallelism: false,
					browser: {
						enabled: true,
						provider: playwright(),
						headless: true,
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.ts'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.ts'],
					exclude: ['src/**/*.svelte.{test,spec}.ts']
				}
			}
		],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.{ts,svelte}'],
			// the callback page's +page.ts is one route setting, checked end to end
			exclude: [
				'src/**/*.test.ts',
				'src/**/*.stories.svelte',
				'src/app.d.ts',
				'src/routes/oauth/callback/+page.ts'
			],
			thresholds: { lines: 99.8, functions: 99.9, branches: 91, statements: 99.8 }
		}
	}
});
