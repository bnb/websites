import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	use: {
		baseURL: 'http://localhost:4175'
	},
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4175,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
