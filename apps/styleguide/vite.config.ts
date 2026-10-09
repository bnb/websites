import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Every story (the design system's and each site's) rendered in Chromium
		// and checked with axe (the a11y addon's `test: 'error'`, see preview.ts).
		projects: [
			{
				extends: './vite.config.ts',
				plugins: [storybookTest({ configDir: '.storybook' })],
				test: {
					name: 'storybook',
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
