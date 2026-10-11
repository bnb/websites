import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'kit',
		environment: 'node',
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.{ts,js}'],
			exclude: ['src/**/*.test.ts', 'src/server/index.ts'],
			thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 }
		}
	}
});
