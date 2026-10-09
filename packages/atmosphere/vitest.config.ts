import { defineConfig } from 'vitest/config';

// Everything runs in Node: the browser is stood in for by a stubbed window
// (location, localStorage) and @atproto/oauth-client-browser by
// src/testing/oauth-client.ts, and no test touches the network.
export default defineConfig({
	test: {
		name: 'atmosphere',
		environment: 'node',
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/testing/**', 'src/index.ts'],
			thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 }
		}
	}
});
