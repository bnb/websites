<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { MIXES } from '../fixtures';
	import MixList from './MixList.svelte';

	const { Story } = defineMeta({
		title: 'tierneycyren.com/MixList',
		component: MixList,
		parameters: { theme: 'dj', layout: 'fullscreen' }
	});
</script>

<Story name="Mixes" args={{ mixes: MIXES }} />

<Story name="None yet" args={{ mixes: [] }} />

<Story name="PDS outage" args={{ mixes: [], loadError: true }} />
