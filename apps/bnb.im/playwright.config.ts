import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	use: {
		// 127.0.0.1, where signing in starts (a page on localhost moves there first)
		baseURL: 'http://127.0.0.1:4174'
	},
	webServer: {
		command: 'npm run build && npm run preview',
		url: 'http://127.0.0.1:4174',
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
