<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Masthead from './Masthead.svelte';

	const { Story } = defineMeta({
		title: 'tierneycyren.com/Masthead',
		component: Masthead,
		parameters: { theme: 'dj', layout: 'fullscreen' }
	});
</script>

<Story name="With the plyr.fm bio" args={{ bio: 'girl rave dj in bushwick' }} />

<Story name="No bio (fallback)" args={{ bio: '' }} />
