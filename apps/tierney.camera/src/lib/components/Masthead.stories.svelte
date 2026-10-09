<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { Profile } from '../types';
	import Masthead from './Masthead.svelte';

	const { Story } = defineMeta({
		title: 'tierney.camera/Masthead',
		component: Masthead,
		parameters: { theme: 'camera', layout: 'fullscreen' }
	});

	const profile: Profile = {
		displayName: 'tierney cyren',
		description: 'girl rave dj. photographer. software. nyc.',
		avatarCid: null
	};
</script>

<Story name="Default" args={{ profile }} />

<Story name="No profile (fallback)" args={{ profile: null }} />
