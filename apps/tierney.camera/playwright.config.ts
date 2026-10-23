import { defineConfig } from '@playwright/test';
import { projects } from '@bnb/testing/playwright';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	projects,
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
