<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SiteHeader from './SiteHeader.svelte';

	const { Story } = defineMeta({
		title: 'bnb.im/SiteHeader',
		component: SiteHeader,
		parameters: { theme: 'bnb', layout: 'fullscreen' }
	});

	const topics = ['AT Protocol', 'Node.js', 'GitHub Actions', 'npm', 'TC39'];
</script>

<Story name="Home" args={{ home: true, topics }} />

<Story name="Elsewhere (small name)" args={{ home: false, topics }} />
