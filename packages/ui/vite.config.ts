import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Component tests run in a real browser (Chromium via Playwright). The stories
// next to each component are rendered, and checked with axe, by the styleguide.
export default defineConfig({
	plugins: [svelte()],
	test: {
		name: 'ui',
		include: ['src/**/*.svelte.test.ts'],
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: 'chromium' }]
		},
		coverage: {
			provider: 'v8',
			include: ['src/lib/**/*.{ts,svelte}'],
			exclude: ['src/**/*.test.ts', 'src/**/*.stories.svelte', 'src/lib/index.ts'],
			thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 }
		}
	}
});
