<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Signoff from './Signoff.svelte';

	const { Story } = defineMeta({
		title: 'Shared/Signoff',
		component: Signoff,
		parameters: { layout: 'fullscreen' }
	});
</script>

<Story name="bnb.im" globals={{ theme: 'bnb' }} args={{ text: ':)' }} />

<Story
	name="tierney.camera"
	globals={{ theme: 'camera' }}
	args={{ text: 'tierney.camera', decorative: true }}
/>

<Story
	name="tierneycyren.com"
	globals={{ theme: 'dj' }}
	args={{ text: 'tierneycyren', decorative: true }}
/>
