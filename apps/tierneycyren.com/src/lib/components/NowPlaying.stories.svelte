<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { MIXES } from '../fixtures';
	import NowPlaying from './NowPlaying.svelte';

	const { Story } = defineMeta({
		title: 'tierneycyren.com/NowPlaying',
		component: NowPlaying,
		parameters: { theme: 'dj', layout: 'fullscreen' },
		args: { mix: MIXES[0], time: 492, duration: 1335, ontoggle: () => {} }
	});
</script>

<Story name="Playing" args={{ playing: true }} />

<Story name="Paused" args={{ playing: false }} />

<Story
	name="A long title"
	args={{ playing: true, mix: { ...MIXES[1], title: `${MIXES[1].title} (extended b2b set)` } }}
/>
