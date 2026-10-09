<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PostTable from './PostTable.svelte';
	import type { Row } from './PostTable.svelte';

	const { Story } = defineMeta({
		title: 'bnb.im/PostTable',
		component: PostTable,
		parameters: { theme: 'bnb' }
	});

	const esm = { label: 'ESM in Node.js 3/3', url: '/series/esm-in-node-js/' };
	const rows: Row[] = [
		{
			n: '14',
			title: 'What is the Atmosphere: An Untech Introduction',
			url: '/posts/what-is-the-atmosphere/',
			topic: 'AT Protocol',
			date: '2026-10-02',
			year: '2026'
		},
		{
			n: '11',
			title: 'Conditional Exports: Supporting both import and require()',
			url: '/posts/conditional-exports-supporting-both-import-and-require/',
			series: esm,
			topic: 'Node.js',
			date: '2021-06-17',
			year: '2021'
		},
		{
			n: '05',
			title: 'Jest and the <code>--changedSince</code> flag in GitHub Actions CI',
			url: '/posts/jest-and-the-changedsince-flag-in-github-actions-ci/',
			topic: 'GitHub Actions',
			date: '2020-04-09',
			year: '2020'
		}
	];

	const parts: Row[] = [
		{ n: '01', title: 'Explicit ESM in Node.js with .mjs', url: '/posts/a/', date: '2021-06-16', year: '2021' },
		{
			n: '02',
			title: 'Implicit ESM in Node.js with "type": "module"',
			url: '/posts/b/',
			date: '2021-06-16',
			year: '2021'
		}
	];
</script>

<Story name="Index" args={{ rows, byYear: true }} />

<Story name="Series parts" args={{ rows: parts, numberLabel: 'Part', topics: false }} />
