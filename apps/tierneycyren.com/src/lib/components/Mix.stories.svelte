<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { MIXES } from '../fixtures';
	import Mix from './Mix.svelte';

	// Real records from the repository, so the covers and audio are the real thing.
	const { Story } = defineMeta({
		title: 'tierneycyren.com/Mix',
		component: Mix,
		parameters: { theme: 'dj', layout: 'padded' }
	});
</script>

<!-- the longest of the two sets the scale of the length bars -->
<Story name="With a description" args={{ mix: MIXES[0], number: '02', longest: 3430 }} />

<Story name="Recorded live" args={{ mix: MIXES[1], number: '01', longest: 3430 }} />

<Story
	name="No cover"
	args={{ mix: { ...MIXES[1], image: '', description: '' }, number: '01', longest: 3430 }}
/>
