<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SiteFooter from './SiteFooter.svelte';

	const { Story } = defineMeta({
		title: 'bnb.im/SiteFooter',
		component: SiteFooter,
		parameters: { theme: 'bnb', layout: 'fullscreen' }
	});
</script>

<Story name="Smile" />
