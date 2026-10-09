import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	use: {
		// 127.0.0.1, where liking signs in from (a page on localhost moves there first)
		baseURL: 'http://127.0.0.1:4173'
	},
	webServer: {
		command: 'npm run build && npm run preview',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
