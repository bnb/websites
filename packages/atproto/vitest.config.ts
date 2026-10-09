import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'atproto',
		environment: 'node',
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts'],
			thresholds: { lines: 100, functions: 100, branches: 95, statements: 100 }
		}
	}
});
