import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';

// Two projects: everything that runs on the server (conversion, sync, the
// files a site serves) in Node, and the subscribe button in a real browser
// (Chromium via Playwright), with @atproto/oauth-client-browser mocked.
export default defineConfig({
	test: {
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/test/**', 'src/index.ts'],
			thresholds: { lines: 99.9, functions: 99.5, branches: 98, statements: 99.8 }
		},
		projects: [
			{
				extends: true,
				test: {
					name: 'node',
					environment: 'node',
					include: ['src/**/*.test.ts'],
					exclude: [...configDefaults.exclude, 'src/**/*.browser.test.ts']
				}
			},
			{
				extends: true,
				// mocked in every test, but found by the import in oauth.ts all the
				// same; optimizing it up front saves Vite reloading mid-run
				optimizeDeps: { include: ['@atproto/oauth-client-browser'] },
				test: {
					name: 'browser',
					include: ['src/**/*.browser.test.ts'],
					// the subscribe button treats a page on localhost as local
					// development and moves it to 127.0.0.1 before signing in, so the
					// tests are served from there to begin with
					api: { host: '127.0.0.1' },
					// the files share one origin's localStorage
					fileParallelism: false,
					browser: {
						enabled: true,
						provider: playwright(),
						headless: true,
						instances: [{ browser: 'chromium' }]
					}
				}
			}
		]
	}
});
