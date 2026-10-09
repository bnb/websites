<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SiteFooter from './SiteFooter.svelte';

	const { Story } = defineMeta({
		title: 'tierneycyren.com/SiteFooter',
		component: SiteFooter,
		parameters: { theme: 'dj', layout: 'fullscreen' }
	});
</script>

<Story name="Default" args={{ mixes: '2 mixes · 1 hr 19 min' }} />
