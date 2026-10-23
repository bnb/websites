import { defineConfig } from '@playwright/test';
import { projects } from '@bnb/testing/playwright';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	projects,
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
