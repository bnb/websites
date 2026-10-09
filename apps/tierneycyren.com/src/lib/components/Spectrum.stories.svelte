<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Spectrum from './Spectrum.svelte';

	// At rest: the flat ticks it shows until a mix plays (the bars need live audio).
	const { Story } = defineMeta({
		title: 'tierneycyren.com/Spectrum',
		component: Spectrum,
		parameters: { theme: 'dj', layout: 'fullscreen' }
	});
</script>

<Story name="At rest" />
