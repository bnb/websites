<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Tokens from '../lib/Tokens.svelte';

	// The three themes share token names, so every component in the design
	// system works in all of them. Each site picks its theme with
	// <html data-theme="…"> and @bnb/ui/themes/<theme>.css.
	const { Story } = defineMeta({
		title: 'Foundations/Tokens',
		component: Tokens,
		parameters: { layout: 'fullscreen' }
	});
</script>

<Story name="bnb.im (Loud)" globals={{ theme: 'bnb' }} />

<Story name="tierney.camera (Flyer)" globals={{ theme: 'camera' }} />

<Story name="tierneycyren.com (Laser)" globals={{ theme: 'dj' }} />
