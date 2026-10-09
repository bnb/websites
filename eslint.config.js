import e18e from '@e18e/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

// oxlint is the primary, fast linter (see .oxlintrc.json). ESLint is here for a
// single, focused purpose: the e18e ("ecosystem performance") ruleset, which
// flags heavy dependencies and un-modern / slow patterns. It's scoped to the
// TypeScript and JavaScript logic, where those rules matter most.
export default [
	{
		ignores: [
			'**/build/',
			'**/.svelte-kit/',
			'**/node_modules/',
			'**/storybook-static/',
			'**/coverage/',
			'**/playwright-report/',
			'**/test-results/',
			'**/lighthouse-report/',
			'**/.lighthouseci/',
			'**/.cache/',
			'**/dist/'
		]
	},
	{
		...e18e.configs.recommended,
		files: ['**/*.{ts,mts,cts,js,mjs,cjs}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: { ecmaVersion: 'latest', sourceType: 'module' }
		}
	}
];
